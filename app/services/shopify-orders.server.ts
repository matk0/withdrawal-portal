import { checkOrderLookupEligibility, normalizeOrderName, type OrderLineItem } from "./withdrawal";
import { normalizeEmail } from "./privacy.server";

export const WITHDRAWAL_ORDER_LOOKUP_QUERY = `#graphql
  query WithdrawalOrderLookup($query: String!) {
    orders(first: 1, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          email
          createdAt
          lineItems(first: 50) {
            edges {
              node {
                id
                name
                title
                sku
                quantity
                variantTitle
              }
            }
          }
        }
      }
    }
  }
`;

interface ShopifyAdminClient {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<Response>;
}

interface ShopifyOrderLookupResponse {
  data?: {
    orders: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          email: string | null;
          createdAt: string;
          lineItems: {
            edges: Array<{
              node: {
                id: string;
                name: string;
                title: string | null;
                sku: string | null;
                quantity: number;
                variantTitle: string | null;
              };
            }>;
          };
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export type WithdrawalOrderLookupResult =
  | { status: "found"; order: WithdrawalOrder }
  | { status: "not_found" }
  | { status: "email_mismatch" }
  | { status: "outside_cutoff"; orderName: string };

export interface WithdrawalOrder {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lineItems: OrderLineItem[];
}

export async function lookupWithdrawalOrder({
  admin,
  orderName,
  email,
  cutoffDays,
  now = new Date(),
}: {
  admin: ShopifyAdminClient;
  orderName: string;
  email: string;
  cutoffDays: number;
  now?: Date;
}): Promise<WithdrawalOrderLookupResult> {
  const normalizedOrderName = normalizeOrderName(orderName);
  const response = await admin.graphql(WITHDRAWAL_ORDER_LOOKUP_QUERY, {
    variables: {
      query: `name:${normalizedOrderName}`,
    },
  });
  const payload = (await response.json()) as ShopifyOrderLookupResponse;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const order = payload.data?.orders.edges[0]?.node;

  if (!order) {
    return { status: "not_found" };
  }

  if (order.name !== normalizedOrderName) {
    return { status: "not_found" };
  }

  if (!order.email || normalizeEmail(order.email) !== normalizeEmail(email)) {
    return { status: "email_mismatch" };
  }

  const eligibility = checkOrderLookupEligibility({
    createdAt: order.createdAt,
    cutoffDays,
    now,
  });

  if (!eligibility.eligible) {
    return { status: "outside_cutoff", orderName: order.name };
  }

  return {
    status: "found",
    order: {
      id: order.id,
      name: order.name,
      email: order.email,
      createdAt: order.createdAt,
      lineItems: order.lineItems.edges.map(({ node }) => ({
        id: node.id,
        title: node.title || node.name,
        variantTitle: node.variantTitle,
        sku: node.sku,
        quantity: node.quantity,
      })),
    },
  };
}
