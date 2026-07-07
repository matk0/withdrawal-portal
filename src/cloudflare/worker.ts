interface Env {
  ORIGIN_URL?: string;
  ORIGIN_URL_SECRET?: string;
  SUPPORT_EMAIL?: string;
}

type FetchImpl = (request: Request) => Promise<Response>;

const PROXY_PREFIXES = [
  "/app",
  "/apps",
  "/auth",
  "/webhooks",
  "/assets",
  "/build",
];

const PROXY_EXACT_PATHS = new Set(["/favicon.ico"]);
const BLOCKED_LEGACY_PATHS = new Set(["/glami.xml"]);

export default {
  fetch(request: Request, env: Env) {
    return handleWithdrawalDomainRequest(request, env, fetch);
  },
};

export async function handleWithdrawalDomainRequest(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
) {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  if (BLOCKED_LEGACY_PATHS.has(path)) {
    return notFound();
  }

  if (shouldProxy(path, url)) {
    return proxyToOrigin(request, env, fetchImpl);
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return notFound();
  }

  if (path === "/") {
    return htmlResponse(renderLandingPage(), request.method);
  }

  if (path === "/privacy") {
    return htmlResponse(renderPrivacyPolicy(env), request.method);
  }

  if (path === "/terms") {
    return htmlResponse(renderTerms(env), request.method);
  }

  if (path === "/support") {
    return htmlResponse(renderSupport(env), request.method);
  }

  return notFound();
}

function shouldProxy(path: string, url: URL) {
  if (PROXY_EXACT_PATHS.has(path)) {
    return true;
  }

  if (path === "/" && url.searchParams.has("shop")) {
    return true;
  }

  return PROXY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

async function proxyToOrigin(request: Request, env: Env, fetchImpl: FetchImpl) {
  const originUrl = env.ORIGIN_URL_SECRET || env.ORIGIN_URL;

  if (!originUrl) {
    return new Response("Origin is not configured", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const origin = new URL(originUrl);
  const incomingUrl = new URL(request.url);
  incomingUrl.protocol = origin.protocol;
  incomingUrl.hostname = origin.hostname;
  incomingUrl.port = origin.port;

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", new URL(request.url).host);
  headers.set("x-forwarded-proto", "https");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  return fetchImpl(new Request(incomingUrl.toString(), init));
}

function normalizePath(path: string) {
  return path === "/" ? "/" : path.replace(/\/+$/, "");
}

function htmlResponse(body: string, method: string) {
  return new Response(method === "HEAD" ? null : body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function renderLandingPage() {
  return pageShell({
    title: "Withdrawal Portal",
    description:
      "A Shopify app that helps EU merchants provide an online withdrawal request function.",
    body: `
      <section class="hero">
        <p class="eyebrow">Shopify app for EU consumer withdrawal workflows</p>
        <h1>Withdrawal Portal</h1>
        <p class="lead">Help customers submit online withdrawal declarations, verify recent Shopify orders, store request evidence, and send confirmation emails.</p>
        <div class="actions">
          <a class="button" href="/privacy">Privacy policy</a>
          <a class="button secondary" href="/support">Support</a>
        </div>
      </section>
      <section class="grid">
        <article>
          <h2>Storefront flow</h2>
          <p>Customers enter their order number and email, choose products and quantities, and confirm their withdrawal request on the merchant domain.</p>
        </article>
        <article>
          <h2>Merchant workflow</h2>
          <p>Merchants review requests in the embedded app, export CSV files, and receive email notifications for each submission.</p>
        </article>
        <article>
          <h2>EU-first handling</h2>
          <p>The app is designed for Slovak, Czech, and English storefront copy, with a configurable order-age cutoff and support address.</p>
        </article>
      </section>
    `,
  });
}

function renderPrivacyPolicy(env: Env) {
  const supportEmail = escapeHtml(env.SUPPORT_EMAIL || "matej@post.work");

  return pageShell({
    title: "Privacy Policy",
    description: "Privacy policy for Withdrawal Portal.",
    body: `
      <section class="document">
        <h1>Privacy Policy</h1>
        <p>Withdrawal Portal helps Shopify merchants receive and manage online withdrawal declarations from their customers.</p>
        <h2>Data we process</h2>
        <p>The app processes the merchant shop domain, order number, order identifier, order creation date, customer email address, selected line items, selected quantities, request timestamps, and audit events needed to evidence the request lifecycle.</p>
        <h2>Why we process it</h2>
        <p>We use this data to verify that a submitted order number and email match a recent Shopify order, display eligible line items, record the customer's submitted withdrawal declaration, notify the merchant, and send a confirmation email to the customer.</p>
        <h2>Retention</h2>
        <p>Withdrawal records are retained for the merchant's configured retention period. The default is three years unless the merchant configures a different period or requests deletion where legally appropriate.</p>
        <h2>Subprocessors and hosting</h2>
        <p>The production service is hosted in Europe. Transactional email may be sent through the merchant-configured email provider, such as Mailgun EU, SMTP, or Postmark.</p>
        <h2>Contact</h2>
        <p>For privacy or support requests, contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      </section>
    `,
  });
}

function renderTerms(env: Env) {
  const supportEmail = escapeHtml(env.SUPPORT_EMAIL || "matej@post.work");

  return pageShell({
    title: "Terms",
    description: "Terms for Withdrawal Portal.",
    body: `
      <section class="document">
        <h1>Terms</h1>
        <p>Withdrawal Portal is provided to help merchants offer an online withdrawal request function. It is not legal advice and does not guarantee legal compliance.</p>
        <p>Merchants remain responsible for their store policies, legal review, return handling, refunds, and customer communication.</p>
        <p>For support, contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      </section>
    `,
  });
}

function renderSupport(env: Env) {
  const supportEmail = escapeHtml(env.SUPPORT_EMAIL || "matej@post.work");

  return pageShell({
    title: "Support",
    description: "Support for Withdrawal Portal.",
    body: `
      <section class="document">
        <h1>Support</h1>
        <p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for installation help, incident reports, privacy requests, or App Store review support.</p>
        <p>Merchants should include their myshopify.com domain and the withdrawal request number when asking about a specific request.</p>
      </section>
    `,
  });
}

function pageShell({
  body,
  description,
  title,
}: {
  body: string;
  description: string;
  title: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | Withdrawal Portal</title>
    <meta name="description" content="${escapeHtml(description)}">
    <style>
      :root {
        color-scheme: light;
        --ink: #18212f;
        --muted: #5f6b7a;
        --line: #d8dee6;
        --soft: #f4f6f8;
        --accent: #0f6b5f;
        --accent-ink: #ffffff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--ink);
        background: #ffffff;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }

      header,
      main,
      footer {
        width: min(1120px, calc(100% - 40px));
        margin: 0 auto;
      }

      header {
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--line);
      }

      nav {
        display: flex;
        gap: 18px;
        font-size: 14px;
      }

      a {
        color: var(--accent);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      main {
        padding: 72px 0;
      }

      .brand {
        font-weight: 700;
        letter-spacing: 0;
      }

      .hero {
        max-width: 760px;
      }

      .eyebrow {
        color: var(--accent);
        font-size: 14px;
        font-weight: 700;
        margin: 0 0 16px;
        text-transform: uppercase;
      }

      h1 {
        font-size: clamp(44px, 7vw, 76px);
        line-height: 0.96;
        margin: 0 0 24px;
        letter-spacing: 0;
      }

      h2 {
        font-size: 20px;
        margin: 0 0 10px;
      }

      p {
        color: var(--muted);
        margin: 0 0 18px;
      }

      .lead {
        font-size: 20px;
        max-width: 700px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border: 1px solid var(--accent);
        background: var(--accent);
        color: var(--accent-ink);
        border-radius: 6px;
        font-weight: 700;
      }

      .button.secondary {
        background: #ffffff;
        color: var(--accent);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-top: 72px;
      }

      article {
        border-top: 1px solid var(--line);
        padding-top: 20px;
      }

      .document {
        max-width: 760px;
      }

      .document h1 {
        font-size: clamp(36px, 6vw, 56px);
      }

      .document h2 {
        margin-top: 34px;
      }

      footer {
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 14px;
        padding: 24px 0 40px;
      }

      @media (max-width: 760px) {
        header {
          height: auto;
          align-items: flex-start;
          flex-direction: column;
          gap: 12px;
          padding: 18px 0;
        }

        nav {
          flex-wrap: wrap;
        }

        main {
          padding: 44px 0;
        }

        .grid {
          grid-template-columns: 1fr;
          margin-top: 48px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">Withdrawal Portal</a>
      <nav aria-label="Primary">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/support">Support</a>
      </nav>
    </header>
    <main>
      ${body}
    </main>
    <footer>Withdrawal Portal is an independent app and is not legal advice.</footer>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
