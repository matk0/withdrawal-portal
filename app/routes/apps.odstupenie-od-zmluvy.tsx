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
  type WithdrawalLocale,
} from "../services/withdrawal";
import { signLookupToken, verifyLookupToken } from "../services/withdrawal-token.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid } = await authenticate.public.appProxy(request);

  return liquid(renderLookupPage({ locale: "liquid" }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const localeFormData = await request.clone().formData();
  const requestedLocale = withdrawalLocale(localeFormData.get("locale"));
  const { admin, liquid, session } = await authenticate.public.appProxy(request);

  if (!admin || !session) {
    const locale = requestedLocale || "sk";
    return liquid(
      renderLookupPage({
        locale,
        error: routeCopy(locale).inactive,
      }),
    );
  }

  const shop = await ensureShop(session.shop);
  const formData = await request.formData();
  const locale = requestedLocale || withdrawalLocale(shop.locale) || "sk";
  const copy = routeCopy(locale);
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
          locale,
          error: copy.lookupFailed,
        }),
      );
    }

    if (result.status === "outside_cutoff") {
      return liquid(
        renderLookupPage({
          locale,
          notice: copy.outsideCutoff,
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
        locale,
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
          locale,
          error: copy.invalidForm,
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
          locale,
          error: copy.recheckFailed,
        }),
      );
    }

    const selectedItems = parseSelectedItems(formData);
    let validItems;
    try {
      validItems = validateSubmissionSelection(result.order.lineItems, selectedItems);
    } catch {
      return liquid(
        renderSelectionPage({
          locale,
          orderName: result.order.name,
          email: result.order.email,
          token,
          lineItems: result.order.lineItems,
          error: copy.invalidSelection,
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
      locale,
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
          locale,
          requestNumber: withdrawalRequest.requestNumber,
          orderName: result.order.name,
          emailFailed: true,
        }),
      );
    }

    return liquid(
      renderSuccessPage({
        locale,
        requestNumber: withdrawalRequest.requestNumber,
        orderName: result.order.name,
      }),
    );
  }

  return liquid(renderLookupPage({ locale, error: copy.unknownAction }));
};

function routeCopy(locale: WithdrawalLocale) {
  if (locale === "cs") {
    return {
      inactive: "Aplikace není pro tento obchod aktivní. Kontaktujte podporu obchodu.",
      lookupFailed: "Objednávku se nepodařilo ověřit. Zkontrolujte číslo objednávky a e-mail nebo kontaktujte podporu obchodu.",
      outsideCutoff: "Online lhůta pro odstoupení u této objednávky podle data jejího vytvoření uplynula. Pokud jde o výjimečný případ, kontaktujte podporu obchodu.",
      invalidForm: "Formulář se pro tento obchod nepodařilo ověřit. Zkuste jej vyplnit znovu.",
      recheckFailed: "Objednávku se nepodařilo znovu ověřit. Vyplňte formulář znovu nebo kontaktujte podporu obchodu.",
      invalidSelection: "Vyberte alespoň jednu položku a zkontrolujte množství.",
      unknownAction: "Neznámá akce formuláře.",
    };
  }

  if (locale === "en") {
    return {
      inactive: "This application is not active for the store. Contact store support.",
      lookupFailed: "The order could not be verified. Check the order number and email address or contact store support.",
      outsideCutoff: "The online withdrawal period for this order has expired based on its creation date. Contact store support if exceptional circumstances apply.",
      invalidForm: "The form could not be verified for this store. Please complete it again.",
      recheckFailed: "The order could not be verified again. Complete the form again or contact store support.",
      invalidSelection: "Select at least one item and check the quantity.",
      unknownAction: "Unknown form action.",
    };
  }

  return {
    inactive: "Aplikácia nie je pre tento obchod aktívna. Kontaktujte podporu obchodu.",
    lookupFailed: "Objednávku sa nepodarilo overiť. Skontrolujte číslo objednávky a e-mail alebo kontaktujte podporu obchodu.",
    outsideCutoff: "Online lehota na odstúpenie pri tejto objednávke podľa dátumu vytvorenia objednávky uplynula. Ak ide o výnimočný prípad, kontaktujte podporu obchodu.",
    invalidForm: "Formulár sa nepodarilo overiť pre tento obchod. Skúste ho vyplniť znova.",
    recheckFailed: "Objednávku sa nepodarilo znovu overiť. Skúste formulár vyplniť znova alebo kontaktujte podporu obchodu.",
    invalidSelection: "Vyberte aspoň jednu položku a skontrolujte množstvo.",
    unknownAction: "Neznáma akcia formulára.",
  };
}

function withdrawalLocale(value: FormDataEntryValue | null): WithdrawalLocale | null {
  return value === "cs" || value === "en" || value === "sk" ? value : null;
}

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
