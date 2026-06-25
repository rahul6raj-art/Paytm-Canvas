import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { OAuthProvider } from "./types";
import { sanitizeOAuthNextPath } from "./types";

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return (
    process.env.CRAFT_OAUTH_STATE_SECRET?.trim() ||
    process.env.CRAFT_API_TOKEN_SECRET?.trim() ||
    "craft-dev-oauth-state-secret"
  );
}

type OAuthStatePayload = {
  next: string;
  provider: OAuthProvider;
  nonce: string;
  ts: number;
};

function signPayload(payload: OAuthStatePayload): string {
  const body = JSON.stringify(payload);
  return createHmac("sha256", stateSecret()).update(body).digest("base64url");
}

export function createOAuthState(provider: OAuthProvider, nextPath?: string | null): string {
  const payload: OAuthStatePayload = {
    next: sanitizeOAuthNextPath(nextPath),
    provider,
    nonce: randomBytes(16).toString("base64url"),
    ts: Date.now(),
  };
  const sig = signPayload(payload);
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString("base64url");
}

export function verifyOAuthState(state: string): { next: string; provider: OAuthProvider } | null {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as OAuthStatePayload & {
      sig?: string;
    };
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.provider !== "google" && parsed.provider !== "github") return null;
    if (typeof parsed.sig !== "string") return null;
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > STATE_TTL_MS) return null;

    const { sig, ...payload } = parsed;
    const expected = signPayload(payload as OAuthStatePayload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return { next: sanitizeOAuthNextPath(payload.next), provider: parsed.provider };
  } catch {
    return null;
  }
}
