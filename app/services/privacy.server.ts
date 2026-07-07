import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

export function hashEmail(email: string) {
  return createHmac("sha256", getSecret()).update(normalizeEmail(email)).digest("hex");
}

export function encryptText(value: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptText(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Encrypted value is malformed");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getSecret() {
  const secret =
    process.env.APP_DATA_ENCRYPTION_KEY ||
    process.env.SHOPIFY_API_SECRET ||
    process.env.LOOKUP_TOKEN_SECRET;

  if (!secret) {
    throw new Error("APP_DATA_ENCRYPTION_KEY is required");
  }

  return secret;
}

function getEncryptionKey() {
  return createHash("sha256").update(getSecret()).digest();
}
