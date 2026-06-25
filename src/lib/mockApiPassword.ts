import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

export function hashMockApiPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyMockApiPassword(password: string, stored: string): boolean {
  const [algo, salt, expected] = stored.split(":");
  if (algo !== "scrypt" || !salt || !expected) return false;
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(derived, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashMockApiSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newMockApiSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
