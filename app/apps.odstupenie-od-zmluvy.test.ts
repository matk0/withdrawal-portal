import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appProxy: vi.fn(),
  createWithdrawalRequest: vi.fn(),
  ensureShop: vi.fn(),
  lookupWithdrawalOrder: vi.fn(),
  markWithdrawalEmailFailed: vi.fn(),
  markWithdrawalEmailsSent: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  verifyLookupToken: vi.fn(),
}));

vi.mock("./shopify.server", () => ({
  authenticate: {
    public: {
      appProxy: mocks.appProxy,
    },
  },
}));

vi.mock("./services/email.server", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

vi.mock("./services/shopify-orders.server", () => ({
  lookupWithdrawalOrder: mocks.lookupWithdrawalOrder,
}));

vi.mock("./services/shops.server", () => ({
  ensureShop: mocks.ensureShop,
}));

vi.mock("./services/withdrawal-records.server", () => ({
  createWithdrawalRequest: mocks.createWithdrawalRequest,
  markWithdrawalEmailFailed: mocks.markWithdrawalEmailFailed,
  markWithdrawalEmailsSent: mocks.markWithdrawalEmailsSent,
}));

vi.mock("./services/withdrawal-token.server", async () => {
  const actual = await vi.importActual<typeof import("./services/withdrawal-token.server")>(
    "./services/withdrawal-token.server",
  );

  return {
    ...actual,
    verifyLookupToken: mocks.verifyLookupToken,
  };
});

import { action } from "./routes/apps.odstupenie-od-zmluvy";

describe("withdrawal app proxy action", () => {
  it("renders a controlled received page when confirmation email delivery fails", async () => {
    process.env.LOOKUP_TOKEN_SECRET = "test-secret";
    mocks.appProxy.mockResolvedValue({
      admin: {},
      session: { shop: "example-store.myshopify.com" },
      liquid: (html: string) => new Response(html),
    });
    mocks.ensureShop.mockResolvedValue({
      id: "shop-id",
      shop: "example-store.myshopify.com",
      shopName: "Example Store",
      locale: "sk",
      cutoffDays: 30,
      supportEmail: null,
      replyToEmail: null,
    });
    mocks.verifyLookupToken.mockResolvedValue({
      shop: "example-store.myshopify.com",
      orderId: "gid://shopify/Order/13223237484918",
      orderName: "#1001",
      email: "matej@post.work",
    });
    mocks.lookupWithdrawalOrder.mockResolvedValue({
      status: "found",
      order: {
        id: "gid://shopify/Order/13223237484918",
        name: "#1001",
        email: "matej@post.work",
        createdAt: "2026-07-06T12:21:16Z",
        lineItems: [
          {
            id: "gid://shopify/LineItem/38139169603958",
            title: "Withdrawal App Test Item",
            variantTitle: null,
            sku: "WITHDRAWAL-TEST",
            quantity: 1,
          },
        ],
      },
    });
    mocks.createWithdrawalRequest.mockResolvedValue({
      id: "request-id",
      requestNumber: "WDR-20260706-F1906C0A",
      submittedAt: new Date("2026-07-06T12:32:15.554Z"),
    });
    mocks.sendTransactionalEmail.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:1025"));
    mocks.markWithdrawalEmailFailed.mockResolvedValue({});

    const body = new URLSearchParams({
      intent: "submit",
      lookupToken: "signed-token",
      lineItemId: "gid://shopify/LineItem/38139169603958",
      "quantity:gid://shopify/LineItem/38139169603958": "1",
    });
    const response = await action({
      request: new Request("https://example-store.myshopify.com/apps/odstupenie-od-zmluvy", {
        method: "POST",
        body,
      }),
      context: {},
      params: {},
      pattern: "/apps/odstupenie-od-zmluvy",
      url: new URL("https://example-store.myshopify.com/apps/odstupenie-od-zmluvy"),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Oznámenie bolo prijaté a uložené");
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('class="header row"'),
      }),
    );
    expect(mocks.markWithdrawalEmailFailed).toHaveBeenCalledWith(
      "request-id",
      "connect ECONNREFUSED 127.0.0.1:1025",
    );
    expect(mocks.markWithdrawalEmailsSent).not.toHaveBeenCalled();
  });
});
