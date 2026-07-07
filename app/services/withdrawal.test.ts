import { describe, expect, it } from "vitest";

import {
  buildConfirmationEmail,
  checkOrderLookupEligibility,
  normalizeOrderName,
  validateSubmissionSelection,
} from "./withdrawal";
import { lookupWithdrawalOrder } from "./shopify-orders.server";
import { signLookupToken, verifyLookupToken } from "./withdrawal-token.server";

describe("withdrawal order lookup", () => {
  it("normalizes order numbers into Shopify order names", () => {
    expect(normalizeOrderName("1007")).toBe("#1007");
    expect(normalizeOrderName(" #1007 ")).toBe("#1007");
  });

  it("allows orders up to 30 days old and blocks older orders", () => {
    const now = new Date("2026-06-24T10:00:00.000Z");

    expect(
      checkOrderLookupEligibility({
        createdAt: "2026-05-25T10:00:00.000Z",
        now,
        cutoffDays: 30,
      }),
    ).toEqual({ eligible: true, reason: "within_cutoff" });

    expect(
      checkOrderLookupEligibility({
        createdAt: "2026-05-24T09:59:59.000Z",
        now,
        cutoffDays: 30,
      }),
    ).toEqual({ eligible: false, reason: "outside_cutoff" });
  });

  it("looks up a matching recent Shopify order without exposing mismatches", async () => {
    const admin = mockAdminOrder({
      name: "#1007",
      email: "Customer@Example.com",
      createdAt: "2026-06-01T10:00:00.000Z",
    });

    await expect(
      lookupWithdrawalOrder({
        admin,
        orderName: "1007",
        email: " customer@example.com ",
        cutoffDays: 30,
        now: new Date("2026-06-24T10:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "found",
      order: {
        name: "#1007",
        email: "Customer@Example.com",
      },
    });
  });

  it("rejects mismatched email, mismatched order name, and orders older than cutoff", async () => {
    await expect(
      lookupWithdrawalOrder({
        admin: mockAdminOrder({
          name: "#1007",
          email: "customer@example.com",
          createdAt: "2026-06-01T10:00:00.000Z",
        }),
        orderName: "1007",
        email: "other@example.com",
        cutoffDays: 30,
        now: new Date("2026-06-24T10:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "email_mismatch" });

    await expect(
      lookupWithdrawalOrder({
        admin: mockAdminOrder({
          name: "#1008",
          email: "customer@example.com",
          createdAt: "2026-06-01T10:00:00.000Z",
        }),
        orderName: "1007",
        email: "customer@example.com",
        cutoffDays: 30,
        now: new Date("2026-06-24T10:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      lookupWithdrawalOrder({
        admin: mockAdminOrder({
          name: "#1007",
          email: "customer@example.com",
          createdAt: "2026-05-01T10:00:00.000Z",
        }),
        orderName: "1007",
        email: "customer@example.com",
        cutoffDays: 30,
        now: new Date("2026-06-24T10:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "outside_cutoff", orderName: "#1007" });
  });
});

describe("withdrawal lookup token", () => {
  it("round-trips and rejects expired signed lookup tokens", async () => {
    const secret = "test-secret-that-is-long-enough";
    const now = new Date("2026-06-24T10:00:00.000Z");
    const token = await signLookupToken(
      {
        shop: "example.myshopify.com",
        orderId: "gid://shopify/Order/1",
        orderName: "#1007",
        email: "customer@example.com",
      },
      secret,
      now,
    );

    expect(await verifyLookupToken(token, secret, now)).toMatchObject({
      shop: "example.myshopify.com",
      orderId: "gid://shopify/Order/1",
      orderName: "#1007",
      email: "customer@example.com",
    });

    await expect(
      verifyLookupToken(token, secret, new Date("2026-06-24T10:16:00.000Z")),
    ).rejects.toThrow("Lookup token expired");
  });
});

describe("withdrawal submission", () => {
  const lineItems = [
    {
      id: "gid://shopify/LineItem/1",
      title: "Silk scarf",
      variantTitle: "Blue",
      sku: "SCARF-BLUE",
      quantity: 2,
    },
    {
      id: "gid://shopify/LineItem/2",
      title: "Gift box",
      variantTitle: null,
      sku: null,
      quantity: 1,
    },
  ];

  it("accepts only positive quantities that exist on the order", () => {
    expect(
      validateSubmissionSelection(lineItems, [
        { lineItemId: "gid://shopify/LineItem/1", quantity: 2 },
      ]),
    ).toEqual([
      {
        id: "gid://shopify/LineItem/1",
        title: "Silk scarf",
        variantTitle: "Blue",
        sku: "SCARF-BLUE",
        quantity: 2,
      },
    ]);

    expect(() =>
      validateSubmissionSelection(lineItems, [
        { lineItemId: "gid://shopify/LineItem/1", quantity: 3 },
      ]),
    ).toThrow("Selected quantity exceeds ordered quantity");

    expect(() =>
      validateSubmissionSelection(lineItems, [
        { lineItemId: "gid://shopify/LineItem/999", quantity: 1 },
      ]),
    ).toThrow("Selected item does not belong to this order");
  });

  it("builds the customer confirmation email as a receipt, not refund approval", () => {
    const email = buildConfirmationEmail({
      requestId: "WDR-20260624-0001",
      orderName: "#1007",
      submittedAt: new Date("2026-06-24T10:00:00.000Z"),
      items: [lineItems[0]],
      shopName: "Keyana",
      locale: "sk",
    });

    expect(email.subject).toBe("Potvrdenie prijatia odstúpenia od zmluvy");
    expect(email.text).toContain("WDR-20260624-0001");
    expect(email.text).toContain("#1007");
    expect(email.text).toContain("Silk scarf");
    expect(email.text).toContain("Toto potvrdenie nie je schválením refundácie");
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain("background-color:#f6f6f6");
    expect(email.html).toContain("Keyana");
    expect(email.html).toContain("WDR-20260624-0001");
    expect(email.html).toContain("Silk scarf");
    expect(email.html).toContain("Toto potvrdenie nie je schválením refundácie");
    expect(email.html).toContain("border-top:1px solid #e5e5e5");
    expect(email.html).toContain('class="header row"');
    expect(email.html).toContain('class="container"');
    expect(email.html).toContain('class="order-list__item"');
    expect(email.html).toContain("#1990C6");
  });

  it("escapes customer-facing HTML email content", () => {
    const email = buildConfirmationEmail({
      requestId: "WDR-20260624-0002",
      orderName: "#1008",
      submittedAt: new Date("2026-06-24T10:00:00.000Z"),
      items: [
        {
          id: "gid://shopify/LineItem/3",
          title: "Silk <script>alert(1)</script>",
          variantTitle: "Blue & Gold",
          sku: "SCARF-<BLUE>",
          quantity: 1,
        },
      ],
      shopName: "Keyana & Co",
      locale: "sk",
    });

    expect(email.html).toContain("Keyana &amp; Co");
    expect(email.html).toContain("Silk &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).toContain("Blue &amp; Gold");
    expect(email.html).toContain("SCARF-&lt;BLUE&gt;");
    expect(email.html).not.toContain("<script>");
  });
});

function mockAdminOrder({
  name,
  email,
  createdAt,
}: {
  name: string;
  email: string | null;
  createdAt: string;
}) {
  return {
    graphql: async () =>
      new Response(
        JSON.stringify({
          data: {
            orders: {
              edges: [
                {
                  node: {
                    id: "gid://shopify/Order/1",
                    name,
                    email,
                    createdAt,
                    lineItems: {
                      edges: [
                        {
                          node: {
                            id: "gid://shopify/LineItem/1",
                            name: "Silk scarf",
                            title: "Silk scarf",
                            sku: "SCARF-BLUE",
                            quantity: 2,
                            variantTitle: "Blue",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  };
}
