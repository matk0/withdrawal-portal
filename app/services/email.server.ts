import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | null;
}

interface PostmarkResponse {
  MessageID?: string;
  ErrorCode?: number;
  Message?: string;
}

export async function sendTransactionalEmail(message: EmailMessage) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.POSTMARK_FROM_EMAIL;

  if (token && from) {
    return sendPostmarkEmail(message, token, from);
  }

  return sendSmtpEmail(message);
}

async function sendPostmarkEmail(message: EmailMessage, token: string, from: string) {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: message.to,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html || undefined,
      ReplyTo: message.replyTo || undefined,
      MessageStream: "outbound",
    }),
  });
  const body = (await response.json()) as PostmarkResponse;

  if (!response.ok) {
    throw new Error(body.Message || "Postmark email send failed");
  }

  return body.MessageID || null;
}

async function sendSmtpEmail(message: EmailMessage) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !port || !user || !pass || !from) {
    throw new Error(
      "POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL or SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL are required",
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: smtpSecure(port),
    auth: {
      user,
      pass,
    },
  });
  const result = await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo || undefined,
  });

  return result.messageId ? `smtp-${result.messageId}` : null;
}

function smtpSecure(port: number) {
  if (process.env.SMTP_SECURE === "true") {
    return true;
  }

  if (process.env.SMTP_SECURE === "false") {
    return false;
  }

  return port === 465;
}
