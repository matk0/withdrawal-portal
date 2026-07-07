# Reviewer Testing Instructions

These instructions are for the Shopify App Store review form. Do not put private credentials or real customer data in this public repository.

## App URLs

- App URL: `https://withdrawals.post.work`
- Redirect URL: `https://withdrawals.post.work/auth/callback`
- App proxy URL: `https://withdrawals.post.work/apps/odstupenie-od-zmluvy`
- Privacy policy: `https://withdrawals.post.work/privacy`
- Support: `https://withdrawals.post.work/support`

## Test Flow

1. Install the app on the review test store.
2. Open the embedded app home.
3. Go to Settings and set store name, default language, support email, reply-to email, and cutoff days.
4. Add the "Withdrawal link" theme app extension block to a visible page, footer, or customer-service section.
5. Create a safe test order using the test email supplied in the private review form.
6. Visit `/apps/odstupenie-od-zmluvy` on the storefront.
7. Enter the test order number and matching email.
8. Select one product and submit the withdrawal request.
9. Confirm the request appears in the embedded app dashboard.
10. Open the request detail page.
11. Export CSV from the app dashboard.
12. Confirm the customer confirmation email and merchant notification email are sent.

## Expected Negative Cases

- Wrong email returns a generic failure without exposing order details.
- Missing order returns a generic failure.
- Orders outside the configured cutoff show manual-review/contact copy.
- Submitting a quantity above the purchased quantity is rejected.

## Notes For Reviewers

Withdrawal Portal helps provide the technical workflow. It is not legal advice and does not guarantee legal compliance.
