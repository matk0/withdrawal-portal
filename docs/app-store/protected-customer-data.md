# Protected Customer Data Answers

Withdrawal Portal requires protected customer data access because it reads customer email addresses on recent orders.

## Level

Level 2: customer data including email fields.

## Fields Requested

- `orders.id`
- `orders.name`
- `orders.email`
- `orders.createdAt`
- `orders.lineItems.id`
- `orders.lineItems.title`
- `orders.lineItems.variantTitle`
- `orders.lineItems.sku`
- `orders.lineItems.quantity`

## Purpose

The app uses order email only to verify that the customer submitting a withdrawal request knows the email attached to the order. The app uses line items only so the customer can select the products and quantities that the withdrawal request covers.

## Data Minimization

The app does not request `read_all_orders`. The default 30-day cutoff fits Shopify's normal recent-order access window.

The app does not need customer address, phone, payment, fulfillment, or marketing consent fields.

## Storage

The app stores customer email in encrypted form and stores a keyed email hash for redaction and lookup workflows. It stores the selected product titles, variant titles, SKUs, quantities, request timestamps, and audit events needed to evidence the request.

## Sharing

Customer email is used to send the withdrawal confirmation through the configured transactional email provider. Withdrawal request data is not sold, used for marketing, or shared with unrelated third parties.

## Retention

The default retention period is three years. Merchants can request a different retention period if legal counsel requires it.

## Security Controls

- Shopify OAuth and app proxy signature validation.
- GraphQL Admin API only.
- Encrypted stored email.
- Keyed email hashes.
- Short-lived signed lookup tokens.
- Mandatory privacy webhooks.
- Production secrets supplied through environment variables.
