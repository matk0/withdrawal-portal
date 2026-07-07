import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import db from "../db.server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../services/shops.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const withdrawalRequest = await db.withdrawalRequest.findFirstOrThrow({
    where: {
      id: params.id,
      shopId: shop.id,
    },
    include: {
      items: true,
      auditEvents: { orderBy: { createdAt: "asc" } },
    },
  });

  return {
    request: {
      requestNumber: withdrawalRequest.requestNumber,
      orderName: withdrawalRequest.orderName,
      status: withdrawalRequest.status,
      submittedAt: withdrawalRequest.submittedAt.toISOString(),
      confirmationEmailId: withdrawalRequest.confirmationEmailId,
      merchantEmailId: withdrawalRequest.merchantEmailId,
      items: withdrawalRequest.items.map((item) => ({
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
      })),
      auditEvents: withdrawalRequest.auditEvents.map((event) => ({
        type: event.type,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
    },
  };
};

export default function RequestDetail() {
  const { request } = useLoaderData<typeof loader>();

  return (
    <s-page heading={request.requestNumber} inlineSize="large">
      <s-section heading="Request">
        <s-stack gap="base">
          <s-paragraph>Order: {request.orderName}</s-paragraph>
          <s-paragraph>Status: {request.status}</s-paragraph>
          <s-paragraph>Submitted: {new Date(request.submittedAt).toLocaleString()}</s-paragraph>
          <s-paragraph>Customer email confirmation: {request.confirmationEmailId || "Not sent"}</s-paragraph>
          <s-paragraph>Merchant notification: {request.merchantEmailId || "Not sent"}</s-paragraph>
        </s-stack>
      </s-section>
      <s-section heading="Items">
        <s-table>
          <s-table-header-row>
            <s-table-header>Product</s-table-header>
            <s-table-header>Variant</s-table-header>
            <s-table-header>SKU</s-table-header>
            <s-table-header>Quantity</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {request.items.map((item, index) => (
              <s-table-row key={`${item.productTitle}-${index}`}>
                <s-table-cell>{item.productTitle}</s-table-cell>
                <s-table-cell>{item.variantTitle || "-"}</s-table-cell>
                <s-table-cell>{item.sku || "-"}</s-table-cell>
                <s-table-cell>{item.quantity}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
      <s-section heading="Audit trail">
        <s-table>
          <s-table-header-row>
            <s-table-header>Time</s-table-header>
            <s-table-header>Event</s-table-header>
            <s-table-header>Message</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {request.auditEvents.map((event) => (
              <s-table-row key={`${event.type}-${event.createdAt}`}>
                <s-table-cell>{new Date(event.createdAt).toLocaleString()}</s-table-cell>
                <s-table-cell>{event.type}</s-table-cell>
                <s-table-cell>{event.message}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
