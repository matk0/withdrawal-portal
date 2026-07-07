import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import db from "../db.server";
import { authenticate } from "../shopify.server";
import { getEmailDeliverySetup } from "../services/email-setup.server";
import { ensureShop } from "../services/shops.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const requests = await db.withdrawalRequest.findMany({
    where: { shopId: shop.id },
    orderBy: { submittedAt: "desc" },
    take: 25,
    include: { items: true },
  });

  return {
    shop: shop.shop,
    proxyPath: "/apps/odstupenie-od-zmluvy",
    settingsComplete: Boolean(shop.supportEmail && shop.replyToEmail),
    supportEmail: shop.supportEmail,
    replyToEmail: shop.replyToEmail,
    emailSetup: getEmailDeliverySetup(),
    requests: requests.map((withdrawalRequest) => ({
      id: withdrawalRequest.id,
      requestNumber: withdrawalRequest.requestNumber,
      orderName: withdrawalRequest.orderName,
      submittedAt: withdrawalRequest.submittedAt.toISOString(),
      status: withdrawalRequest.status,
      itemCount: withdrawalRequest.items.length,
    })),
  };
};

export default function Index() {
  const { emailSetup, proxyPath, replyToEmail, requests, settingsComplete, supportEmail } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Online withdrawal requests" inlineSize="large">
      <s-button slot="primary-action" href="/app/export">
        Export CSV
      </s-button>
      {!emailSetup.configured ? (
        <s-banner heading="Transactional email needs setup" tone="warning">
          Withdrawal requests are saved, but customer confirmations will be marked for manual review
          until a remote sender is connected. Configure Postmark or SMTP with a verified sender domain.
        </s-banner>
      ) : null}
      <s-section heading="Setup guide">
        <s-stack gap="base">
          <s-paragraph>
            Complete these steps before relying on the app in production. Use a verified sender on
            your own domain, for example withdrawals@post.work or legal@post.work.
          </s-paragraph>
          <s-table>
            <s-table-header-row>
              <s-table-header>Step</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>What to do</s-table-header>
            </s-table-header-row>
            <s-table-body>
              <s-table-row>
                <s-table-cell>Storefront link</s-table-cell>
                <s-table-cell>
                  <s-badge tone="info">Manual check</s-badge>
                </s-table-cell>
                <s-table-cell>
                  Add a visible footer, policy page, or customer-service link to{" "}
                  <s-link href={proxyPath}>{proxyPath}</s-link>.
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>Merchant emails</s-table-cell>
                <s-table-cell>
                  <s-badge tone={settingsComplete ? "success" : "warning"}>
                    {settingsComplete ? "Configured" : "Missing"}
                  </s-badge>
                </s-table-cell>
                <s-table-cell>
                  Set support and reply-to emails in Settings. Current support:{" "}
                  {supportEmail || "not set"}; reply-to: {replyToEmail || "not set"}.
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>Transactional sender</s-table-cell>
                <s-table-cell>
                  <s-badge tone={emailSetup.configured ? "success" : "critical"}>
                    {emailSetup.configured ? "Configured" : "Not configured"}
                  </s-badge>
                </s-table-cell>
                <s-table-cell>
                  Verify SPF, DKIM, tracking, and return-path records with Mailgun EU, Postmark, or
                  another provider. {emailSetup.message}
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>End-to-end test</s-table-cell>
                <s-table-cell>
                  <s-badge tone="info">Manual check</s-badge>
                </s-table-cell>
                <s-table-cell>
                  Create a safe test order, submit a withdrawal, confirm the request appears here,
                  and confirm the customer email arrives.
                </s-table-cell>
              </s-table-row>
            </s-table-body>
          </s-table>
        </s-stack>
      </s-section>
      <s-section heading="Storefront setup">
        <s-stack gap="base">
          <s-paragraph>
            Add the theme app block to your footer, legal page, or customer service page.
            The public withdrawal function is available at <s-link href={proxyPath}>{proxyPath}</s-link>.
          </s-paragraph>
          <s-paragraph>
            Use the button label “Odstúpiť od zmluvy tu” for Slovak stores.
          </s-paragraph>
        </s-stack>
      </s-section>
      <s-section heading="Latest requests">
        {requests.length === 0 ? (
          <s-paragraph>No withdrawal requests have been submitted yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Request</s-table-header>
              <s-table-header>Order</s-table-header>
              <s-table-header>Items</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Submitted</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {requests.map((request) => (
                <s-table-row key={request.id}>
                  <s-table-cell>
                    <s-link href={`/app/requests/${request.id}`}>{request.requestNumber}</s-link>
                  </s-table-cell>
                  <s-table-cell>{request.orderName}</s-table-cell>
                  <s-table-cell>{request.itemCount}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={request.status === "RECEIVED" ? "success" : "warning"}>
                      {request.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{new Date(request.submittedAt).toLocaleString()}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
