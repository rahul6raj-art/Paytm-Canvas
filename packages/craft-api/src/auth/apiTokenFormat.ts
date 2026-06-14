import { randomBytes } from "node:crypto";

export const API_TOKEN_PREFIX = "craft_pat_";

export function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function isApiTokenFormat(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX) && token.length >= API_TOKEN_PREFIX.length + 16;
}

export function newApiTokenSecret(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function apiTokenDisplayPrefix(token: string): string {
  return token.slice(0, 16);
}
