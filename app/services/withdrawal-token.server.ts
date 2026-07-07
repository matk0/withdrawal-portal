import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export interface LookupTokenPayload {
  shop: string;
  orderId: string;
  orderName: string;
  email: string;
}

interface StoredLookupTokenPayload extends LookupTokenPayload {
  expiresAt: string;
}

export async function signLookupToken(
  payload: LookupTokenPayload,
  secret: string,
  now = new Date(),
) {
  const body: StoredLookupTokenPayload = {
    ...payload,
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
  };
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedBody, secret);

  return `${encodedBody}.${signature}`;
}

export async function verifyLookupToken(
  token: string,
  secret: string,
  now = new Date(),
) {
  const [encodedBody, signature] = token.split(".");

  if (!encodedBody || !signature) {
    throw new Error("Lookup token is malformed");
  }

  const expectedSignature = sign(encodedBody, secret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error("Lookup token signature is invalid");
  }

  const payload = JSON.parse(base64UrlDecode(encodedBody)) as StoredLookupTokenPayload;

  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    throw new Error("Lookup token expired");
  }

  return payload;
}

function sign(encodedBody: string, secret: string) {
  return createHmac("sha256", secret).update(encodedBody).digest("base64url");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
