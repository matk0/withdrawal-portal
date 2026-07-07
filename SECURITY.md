# Security Policy

## Reporting

Report security issues privately to matej@post.work.

Do not open a public GitHub issue for vulnerabilities, secrets, customer data exposure, authentication bypasses, or data deletion bugs.

## Supported Version

The hosted App Store version and the latest `main` branch receive security fixes.

## Data Handling

Withdrawal Portal stores customer email addresses encrypted at rest and stores a keyed hash for lookup/redaction workflows. The app does not use withdrawal data for marketing or profiling.

Production deployments must set unique values for:

```text
APP_DATA_ENCRYPTION_KEY
LOOKUP_TOKEN_SECRET
SHOPIFY_API_SECRET
```

Rotate all related secrets if any deployment environment is exposed.
