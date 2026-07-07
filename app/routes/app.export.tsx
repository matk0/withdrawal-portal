import type { LoaderFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../services/shops.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const requests = await db.withdrawalRequest.findMany({
    where: { shopId: shop.id },
    orderBy: { submittedAt: "desc" },
    include: { items: true },
  });
  const rows = [
    ["request_number", "order_name", "status", "submitted_at", "item_title", "variant_title", "sku", "quantity"],
    ...requests.flatMap((withdrawalRequest) =>
      withdrawalRequest.items.map((item) => [
        withdrawalRequest.requestNumber,
        withdrawalRequest.orderName,
        withdrawalRequest.status,
        withdrawalRequest.submittedAt.toISOString(),
        item.productTitle,
        item.variantTitle || "",
        item.sku || "",
        String(item.quantity),
      ]),
    ),
  ];

  return new Response(rows.map(toCsvRow).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="withdrawal-requests.csv"',
    },
  });
};

function toCsvRow(row: string[]) {
  return row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",");
}
