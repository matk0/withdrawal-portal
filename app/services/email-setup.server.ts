export interface EmailDeliverySetup {
  configured: boolean;
  provider: "postmark" | "smtp" | "none";
  message: string;
  missing: string[];
}

export function getEmailDeliverySetup(env = process.env): EmailDeliverySetup {
  if (hasValue(env.POSTMARK_SERVER_TOKEN) && hasValue(env.POSTMARK_FROM_EMAIL)) {
    return {
      configured: true,
      provider: "postmark",
      message: "Transactional email is configured through Postmark.",
      missing: [],
    };
  }

  const smtpFields = [
    env.SMTP_HOST,
    env.SMTP_USER,
    env.SMTP_PASS,
    env.SMTP_FROM_EMAIL,
  ];
  if (smtpFields.every(hasValue) && !isLocalSmtpHost(env.SMTP_HOST)) {
    return {
      configured: true,
      provider: "smtp",
      message: "Transactional email is configured through SMTP.",
      missing: [],
    };
  }

  return {
    configured: false,
    provider: "none",
    message: "Transactional email is not configured for production delivery.",
    missing: ["remote SMTP host or Postmark credentials"],
  };
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function isLocalSmtpHost(host: string | undefined) {
  const value = host?.trim().toLowerCase();
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}
