import db from "../db.server";
import { encryptText, hashEmail } from "./privacy.server";
import type { SelectedWithdrawalItem } from "./withdrawal";

export async function createWithdrawalRequest({
  shopId,
  shopDomain,
  orderId,
  orderName,
  customerEmail,
  items,
}: {
  shopId: string;
  shopDomain: string;
  orderId: string;
  orderName: string;
  customerEmail: string;
  items: SelectedWithdrawalItem[];
}) {
  const requestNumber = createRequestNumber();

  return db.withdrawalRequest.create({
    data: {
      requestNumber,
      shopId,
      shopDomain,
      orderId,
      orderName,
      customerEmailHash: hashEmail(customerEmail),
      encryptedCustomerEmail: encryptText(customerEmail),
      cutoffDecision: "within_30_days_from_order_creation",
      items: {
        create: items.map((item) => ({
          lineItemId: item.id,
          productTitle: item.title,
          variantTitle: item.variantTitle,
          sku: item.sku,
          quantity: item.quantity,
        })),
      },
      auditEvents: {
        create: {
          shopId,
          type: "withdrawal.received",
          message: "Customer submitted online withdrawal declaration",
          metadata: {
            orderId,
            orderName,
            itemCount: items.length,
          },
        },
      },
    },
    include: {
      items: true,
    },
  });
}

export async function markWithdrawalEmailsSent({
  requestId,
  confirmationEmailId,
  merchantEmailId,
}: {
  requestId: string;
  confirmationEmailId: string | null;
  merchantEmailId: string | null;
}) {
  return db.withdrawalRequest.update({
    where: { id: requestId },
    data: {
      confirmationEmailId,
      merchantEmailId,
      auditEvents: {
        create: {
          shopId: (await db.withdrawalRequest.findUniqueOrThrow({
            where: { id: requestId },
            select: { shopId: true },
          })).shopId,
          type: "withdrawal.confirmation_sent",
          message: "Withdrawal confirmation emails sent",
          metadata: {
            confirmationEmailId,
            merchantEmailId,
          },
        },
      },
    },
  });
}

export async function markWithdrawalEmailFailed(requestId: string, message: string) {
  const request = await db.withdrawalRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { shopId: true },
  });

  return db.withdrawalRequest.update({
    where: { id: requestId },
    data: {
      status: "EMAIL_FAILED",
      auditEvents: {
        create: {
          shopId: request.shopId,
          type: "withdrawal.email_failed",
          message,
        },
      },
    },
  });
}

function createRequestNumber() {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `WDR-${today}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
