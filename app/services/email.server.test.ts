import { createServer, type Server } from "net";

import { afterEach, describe, expect, it } from "vitest";

import { sendTransactionalEmail } from "./email.server";

const originalEnv = { ...process.env };
let server: Server | undefined;

afterEach(async () => {
  process.env = { ...originalEnv };

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  }
});

describe("transactional email delivery", () => {
  it("falls back to SMTP when Postmark is not configured", async () => {
    const messages: string[] = [];
    const port = await startSmtpServer(messages);

    delete process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.POSTMARK_FROM_EMAIL;
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "smtp-user";
    process.env.SMTP_PASS = "smtp-pass";
    process.env.SMTP_FROM_EMAIL = "legal@example.com";

    await expect(
      sendTransactionalEmail({
        to: "customer@example.com",
        subject: "Potvrdenie prijatia odstúpenia od zmluvy",
        text: "Prijali sme odstúpenie od zmluvy.",
        html: "<p>Prijali sme odstúpenie od zmluvy.</p>",
        replyTo: "support@example.com",
      }),
    ).resolves.toMatch(/^smtp-/);

    expect(messages.join("\n")).toContain("From: legal@example.com");
    expect(messages.join("\n")).toContain("To: customer@example.com");
    expect(messages.join("\n")).toContain("Reply-To: support@example.com");
    expect(messages.join("\n")).toContain("multipart/alternative");
    expect(messages.join("\n")).toContain("Content-Type: text/html");
  });
});

async function startSmtpServer(messages: string[]) {
  server = createServer((socket) => {
    let dataMode = false;
    let dataBuffer = "";

    socket.write("220 local smtp ready\r\n");
    socket.on("data", (chunk) => {
      const value = chunk.toString("utf8");

      if (dataMode) {
        dataBuffer += value;
        if (dataBuffer.includes("\r\n.\r\n")) {
          messages.push(dataBuffer.slice(0, dataBuffer.indexOf("\r\n.\r\n")));
          dataMode = false;
          dataBuffer = "";
          socket.write("250 queued as test-message\r\n");
        }
        return;
      }

      for (const command of value.split(/\r\n/).filter(Boolean)) {
        if (command.startsWith("EHLO") || command.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (command.startsWith("AUTH")) {
          socket.write("235 authenticated\r\n");
        } else if (command.startsWith("MAIL FROM") || command.startsWith("RCPT TO")) {
          socket.write("250 ok\r\n");
        } else if (command === "DATA") {
          dataMode = true;
          socket.write("354 end data with <CR><LF>.<CR><LF>\r\n");
        } else if (command === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else {
          socket.write("250 ok\r\n");
        }
      }
    });
  });

  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("SMTP test server did not bind to a TCP port");
  }

  return address.port;
}
