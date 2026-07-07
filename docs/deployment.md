# Deployment

## Production Host

The Node app can run on any host that supports Docker and PostgreSQL. The included deployment files target a single-host Docker Compose setup.

## Cloudflare Edge Domain

The public domain is configured in `wrangler.jsonc`:

```text
https://withdrawals.post.work
```

The Worker serves public pages and proxies Shopify app routes to the app origin configured by `ORIGIN_URL`.

## Deploy Edge Worker

```bash
npm run cf:types
npm run cf:dry-run
npm run cf:deploy
```

## Deploy Shopify App Configuration

Validate first:

```bash
shopify app config validate --json
```

Create and release a Shopify app version:

```bash
shopify app deploy --version v0.1.0 --message "Release App Store preparation"
```

When deploying from CI, use an App Automation Token and pass `--source-control-url` so the Shopify app version points back to the released GitHub commit.

## Deploy Node App

Production must provide:

- Shopify API key and secret
- database URL
- encryption and lookup-token secrets
- transactional email settings
- `SHOPIFY_APP_URL=https://withdrawals.post.work`

Run:

```bash
docker compose --env-file /opt/withdrawal-portal/.env.production -f deploy/hetzner/compose.yml build app
docker compose --env-file /opt/withdrawal-portal/.env.production -f deploy/hetzner/compose.yml up -d app
```
