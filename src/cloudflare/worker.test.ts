import { describe, expect, it, vi } from "vitest";

import { handleWithdrawalDomainRequest } from "./worker";

const env = {
  ORIGIN_URL: "https://origin.example.test",
  SUPPORT_EMAIL: "matej@post.work",
};

describe("withdrawal domain Worker", () => {
  it("renders the public product page at the root", async () => {
    const response = await handleWithdrawalDomainRequest(
      new Request("https://withdrawals.post.work/"),
      env,
      vi.fn(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Withdrawal Portal");
  });

  it("returns headers without a body for public HEAD requests", async () => {
    const response = await handleWithdrawalDomainRequest(
      new Request("https://withdrawals.post.work/", { method: "HEAD" }),
      env,
      vi.fn(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe("");
  });

  it("renders the privacy policy used by the App Store listing", async () => {
    const response = await handleWithdrawalDomainRequest(
      new Request("https://withdrawals.post.work/privacy"),
      env,
      vi.fn(),
    );

    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("order number");
    expect(html).toContain("matej@post.work");
  });

  it("proxies Shopify app routes to the origin without changing the path or query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("proxied"));

    const response = await handleWithdrawalDomainRequest(
      new Request("https://withdrawals.post.work/auth/callback?shop=test.myshopify.com"),
      env,
      fetchImpl,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("proxied");
    const proxiedRequest = fetchImpl.mock.calls[0][0] as Request;
    expect(proxiedRequest.url).toBe(
      "https://origin.example.test/auth/callback?shop=test.myshopify.com",
    );
  });

  it("does not expose legacy Keyana-only utility routes on the public app domain", async () => {
    const fetchImpl = vi.fn();

    const response = await handleWithdrawalDomainRequest(
      new Request("https://withdrawals.post.work/glami.xml"),
      env,
      fetchImpl,
    );

    expect(response.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
