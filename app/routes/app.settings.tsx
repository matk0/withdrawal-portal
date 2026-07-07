import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { ensureShop, updateShopSettings } from "../services/shops.server";
import type { WithdrawalLocale } from "../services/withdrawal";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  return {
    shopName: shop.shopName || "",
    locale: shop.locale,
    cutoffDays: shop.cutoffDays,
    supportEmail: shop.supportEmail || "",
    replyToEmail: shop.replyToEmail || "",
    proxyPath: "/apps/odstupenie-od-zmluvy",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);
  const formData = await request.formData();
  const cutoffDays = Number(formData.get("cutoffDays"));

  if (!Number.isInteger(cutoffDays) || cutoffDays < 1 || cutoffDays > 120) {
    return { ok: false, message: "Cutoff days must be between 1 and 120." };
  }

  await updateShopSettings(session.shop, {
    shopName: nullableString(formData.get("shopName")),
    locale: localeValue(formData.get("locale")),
    cutoffDays,
    supportEmail: nullableString(formData.get("supportEmail")),
    replyToEmail: nullableString(formData.get("replyToEmail")),
  });

  return { ok: true, message: "Settings saved." };
};

export default function Settings() {
  const settings = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Settings" inlineSize="small">
      {actionData?.message ? (
        <s-banner tone={actionData.ok ? "success" : "critical"}>{actionData.message}</s-banner>
      ) : null}
      <s-section heading="Withdrawal function">
        <Form method="post">
          <s-stack gap="base">
            <s-text-field label="Store name" name="shopName" defaultValue={settings.shopName}></s-text-field>
            <s-select label="Default language" name="locale" value={settings.locale}>
              <s-option value="sk">Slovak</s-option>
              <s-option value="cs">Czech</s-option>
              <s-option value="en">English</s-option>
            </s-select>
            <s-number-field
              label="Order age cutoff in days"
              name="cutoffDays"
              min={1}
              max={120}
              defaultValue={String(settings.cutoffDays)}
            ></s-number-field>
            <s-email-field label="Support email" name="supportEmail" defaultValue={settings.supportEmail}></s-email-field>
            <s-email-field label="Reply-to email" name="replyToEmail" defaultValue={settings.replyToEmail}></s-email-field>
            <s-button variant="primary" type="submit">
              Save settings
            </s-button>
          </s-stack>
        </Form>
      </s-section>
      <s-section heading="Theme placement">
        <s-paragraph>
          Add the app block in the theme editor. Public path: <s-link href={settings.proxyPath}>{settings.proxyPath}</s-link>.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

function nullableString(value: FormDataEntryValue | null) {
  const string = typeof value === "string" ? value.trim() : "";
  return string || null;
}

function localeValue(value: FormDataEntryValue | null): WithdrawalLocale {
  return value === "cs" || value === "en" ? value : "sk";
}
