# Withdrawal Portal

Withdrawal Portal is an open-source Shopify app that helps EU merchants provide an online withdrawal request function on their storefront.

The app lets a customer enter an order number and email address, verifies the order through the Shopify Admin GraphQL API, blocks normal self-service submission outside the configured order-age cutoff, records the submitted request, and sends confirmation emails.

It is not legal advice and does not guarantee legal compliance. Merchants remain responsible for their store policies, legal review, refund handling, and customer communication.

## Features

- Embedded Shopify admin app for request review, detail pages, settings, and CSV export.
- Theme app extension block for visible storefront links.
- App proxy customer flow at `/apps/odstupenie-od-zmluvy`.
- Recent order lookup by order name and exact email match.
- Configurable cutoff period, defaulting to 30 days.
- Slovak, Czech, and English customer-facing copy.
- Encrypted customer email storage plus HMAC email hashes for lookup/redaction.
- Mandatory Shopify privacy and lifecycle webhooks.
- Transactional email through Postmark or SMTP.
- Cloudflare Worker facade for public product, privacy, support, and terms pages.

## Architecture

- Shopify React Router app, hosted as a Node.js service.
- PostgreSQL through Prisma.
- Theme app extension for storefront placement.
- Shopify app proxy for customer submissions.
- Cloudflare Worker at `https://withdrawals.post.work` for public pages and edge proxying to the app origin.
- Docker Compose deployment example for a single-host Hetzner deployment.

## Required Shopify Scopes

```text
read_orders,write_app_proxy
```

The app intentionally avoids `read_all_orders` in v1. It only needs Shopify's normal recent-order access window because the default cutoff is 30 days from order creation.

## Local Development

```bash
npm install
npm run typecheck
npm test
npm run build
shopify app dev
```

Copy `.env.example` to `.env` for local app variables. Do not commit real secrets.

## Production Environment

Required app variables:

```text
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SCOPES
DATABASE_URL
APP_DATA_ENCRYPTION_KEY
LOOKUP_TOKEN_SECRET
```

Transactional email requires either Postmark:

```text
POSTMARK_SERVER_TOKEN
POSTMARK_FROM_EMAIL
```

or SMTP:

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM_EMAIL
```

## Cloudflare Edge

The public domain Worker is configured in `wrangler.jsonc`.

```bash
npm run cf:types
npm run cf:dry-run
npm run cf:deploy
```

The Worker serves public pages and proxies Shopify app routes to the configured origin. It deliberately blocks legacy/private utility paths that do not belong to the public App Store app.

## Shopify App Store

Submission materials live in `docs/app-store/`:

- `listing.md`
- `protected-customer-data.md`
- `reviewer-testing.md`

Run local checks before creating or releasing a Shopify app version:

```bash
npm run ci
shopify app config validate --json
shopify app deploy --version v0.1.0
```

Shopify App Store submission itself is completed in the Partner Dashboard. The review page requires listing fields, protected customer data answers, app icon, screenshots, reviewer credentials, automated checks, and final submission.

## License

Apache-2.0.
