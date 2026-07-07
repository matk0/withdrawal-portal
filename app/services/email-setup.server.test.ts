import { afterEach, describe, expect, it } from "vitest";

import { getEmailDeliverySetup } from "./email-setup.server";

const ORIGINAL_ENV = { ...process.env };

describe("email delivery setup", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("treats localhost SMTP as not configured for production delivery", () => {
    process.env.POSTMARK_SERVER_TOKEN = "";
    process.env.POSTMARK_FROM_EMAIL = "";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_USER = "bridge-user";
    process.env.SMTP_PASS = "bridge-pass";
    process.env.SMTP_FROM_EMAIL = "legal@post.work";

    expect(getEmailDeliverySetup()).toEqual({
      configured: false,
      provider: "none",
      message: "Transactional email is not configured for production delivery.",
      missing: ["remote SMTP host or Postmark credentials"],
    });
  });

  it("accepts a complete remote SMTP provider", () => {
    process.env.POSTMARK_SERVER_TOKEN = "";
    process.env.POSTMARK_FROM_EMAIL = "";
    process.env.SMTP_HOST = "smtp.eu.mailgun.org";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "postmaster@post.work";
    process.env.SMTP_PASS = "mailgun-password";
    process.env.SMTP_FROM_EMAIL = "withdrawals@post.work";

    expect(getEmailDeliverySetup()).toEqual({
      configured: true,
      provider: "smtp",
      message: "Transactional email is configured through SMTP.",
      missing: [],
    });
  });
});
