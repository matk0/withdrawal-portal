import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { sendTransactionalEmail } from "../services/email.server";
import { lookupWithdrawalOrder } from "../services/shopify-orders.server";
import { ensureShop } from "../services/shops.server";
import {
  renderLookupPage,
  renderSelectionPage,
  renderSuccessPage,
} from "../services/withdrawal-proxy-ui.server";
import {
  createWithdrawalRequest,
  markWithdrawalEmailFailed,
  markWithdrawalEmailsSent,
} from "../services/withdrawal-records.server";
import {
  buildConfirmationEmail,
  validateSubmissionSelection,
  type SelectedLineItem,
} from "../services/withdrawal";
import { signLookupToken, verifyLookupToken } from "../services/withdrawal-token.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid } = await authenticate.public.appProxy(request);

  return liquid(renderLookupPage());
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, liquid, session } = await authenticate.public.appProxy(request);

  if (!admin || !session) {
    return liquid(
      renderLookupPage({
        error: "Aplikácia nie je pre tento obchod aktívna. Kontaktujte podporu obchodu.",
      }),
    );
  }

  const shop = await ensureShop(session.shop);
  const formData = await request.formData();
  const intent = stringValue(formData.get("intent"));

  if (intent === "lookup") {
    const orderName = stringValue(formData.get("orderName"));
    const email = stringValue(formData.get("email"));
    const result = await lookupWithdrawalOrder({
      admin,
      orderName,
      email,
      cutoffDays: shop.cutoffDays,
    });

    if (result.status === "not_found" || result.status === "email_mismatch") {
      return liquid(
        renderLookupPage({
          error:
            "Objednávku sa nepodarilo overiť. Skontrolujte číslo objednávky a e-mail alebo kontaktujte podporu obchodu.",
        }),
      );
    }

    if (result.status === "outside_cutoff") {
      return liquid(
        renderLookupPage({
          notice:
            "Online lehota na odstúpenie pri tejto objednávke podľa dátumu vytvorenia objednávky uplynula. Ak ide o výnimočný prípad, kontaktujte podporu obchodu.",
        }),
      );
    }

    const token = await signLookupToken(
      {
        shop: session.shop,
        orderId: result.order.id,
        orderName: result.order.name,
        email: result.order.email,
      },
      lookupTokenSecret(),
    );

    return liquid(
      renderSelectionPage({
        orderName: result.order.name,
        email: result.order.email,
        token,
        lineItems: result.order.lineItems,
      }),
    );
  }

  if (intent === "submit") {
    const token = stringValue(formData.get("lookupToken"));
    const tokenPayload = await verifyLookupToken(token, lookupTokenSecret());
    if (tokenPayload.shop !== session.shop) {
      return liquid(
        renderLookupPage({
          error:
            "Formulár sa nepodarilo overiť pre tento obchod. Skúste ho vyplniť znova.",
        }),
      );
    }

    const result = await lookupWithdrawalOrder({
      admin,
      orderName: tokenPayload.orderName,
      email: tokenPayload.email,
      cutoffDays: shop.cutoffDays,
    });

    if (result.status !== "found") {
      return liquid(
        renderLookupPage({
          error:
            "Objednávku sa nepodarilo znovu overiť. Skúste formulár vyplniť znova alebo kontaktujte podporu obchodu.",
        }),
      );
    }

    const selectedItems = parseSelectedItems(formData);
    let validItems;
    try {
      validItems = validateSubmissionSelection(result.order.lineItems, selectedItems);
    } catch (error) {
      return liquid(
        renderSelectionPage({
          orderName: result.order.name,
          email: result.order.email,
          token,
          lineItems: result.order.lineItems,
          error:
            error instanceof Error
              ? error.message
              : "Vyberte aspoň jednu položku a skontrolujte množstvo.",
        }),
      );
    }
    const withdrawalRequest = await createWithdrawalRequest({
      shopId: shop.id,
      shopDomain: session.shop,
      orderId: result.order.id,
      orderName: result.order.name,
      customerEmail: result.order.email,
      items: validItems,
    });
    const email = buildConfirmationEmail({
      requestId: withdrawalRequest.requestNumber,
      orderName: result.order.name,
      submittedAt: withdrawalRequest.submittedAt,
      items: validItems,
      shopName: shop.shopName || session.shop,
      locale: shop.locale === "cs" || shop.locale === "en" ? shop.locale : "sk",
    });

    try {
      const confirmationEmailId = await sendTransactionalEmail({
        to: result.order.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        replyTo: shop.replyToEmail || shop.supportEmail,
      });
      const merchantEmailId = shop.supportEmail
        ? await sendTransactionalEmail({
            to: shop.supportEmail,
            subject: `Nové odstúpenie od zmluvy ${withdrawalRequest.requestNumber}`,
            text: [
              `Prijaté odstúpenie od zmluvy pre objednávku ${result.order.name}.`,
              `Číslo žiadosti: ${withdrawalRequest.requestNumber}`,
              `Počet položiek: ${validItems.length}`,
            ].join("\n"),
          })
        : null;

      await markWithdrawalEmailsSent({
        requestId: withdrawalRequest.id,
        confirmationEmailId,
        merchantEmailId,
      });
    } catch (error) {
      await markWithdrawalEmailFailed(
        withdrawalRequest.id,
        error instanceof Error ? error.message : "Confirmation email failed",
      );

      return liquid(
        renderSuccessPage({
          requestNumber: withdrawalRequest.requestNumber,
          orderName: result.order.name,
          emailFailed: true,
        }),
      );
    }

    return liquid(
      renderSuccessPage({
        requestNumber: withdrawalRequest.requestNumber,
        orderName: result.order.name,
      }),
    );
  }

  return liquid(renderLookupPage({ error: "Neznáma akcia formulára." }));
};

function parseSelectedItems(formData: FormData): SelectedLineItem[] {
  const lineItemIds = formData.getAll("lineItemId").map(stringValue);

  return lineItemIds.map((lineItemId) => ({
    lineItemId,
    quantity: Number(formData.get(`quantity:${lineItemId}`)),
  }));
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function lookupTokenSecret() {
  const secret = process.env.LOOKUP_TOKEN_SECRET || process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    throw new Error("LOOKUP_TOKEN_SECRET is required");
  }

  return secret;
}
