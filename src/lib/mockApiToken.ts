import { createHash, randomBytes } from "node:crypto";
import { API_TOKEN_PREFIX, isApiTokenFormat } from "@/lib/apiTokenAuth";
import type { CraftApiTokenResourceScope, CraftApiTokenScope } from "@/lib/apiClient";
import type { MockApiTokenResourceScope, MockApiTokenScope } from "@/lib/mockApiTokenScope";

export const MAX_MOCK_API_TOKEN_EXPIRES_DAYS = 365;

export interface MockApiTokenRow {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scope: MockApiTokenScope;
  resourceScopes: MockApiTokenResourceScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function hashMockApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newMockApiTokenSecret(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function mockApiTokenDisplayPrefix(token: string): string {
  return token.slice(0, 16);
}

export function parseMockApiTokenExpiresInDays(raw: unknown): number | null | undefined {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return undefined;
  if (n > MAX_MOCK_API_TOKEN_EXPIRES_DAYS) return undefined;
  return n;
}

export function computeMockApiTokenExpiresAt(days: number | null): string | null {
  if (days == null) return null;
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString();
}

export function mockApiTokenToDto(row: MockApiTokenRow): {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: CraftApiTokenScope;
  resourceScopes: CraftApiTokenResourceScope[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
} {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scope: row.scope,
    resourceScopes: row.resourceScopes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
  };
}

export function isMockApiTokenActive(row: MockApiTokenRow, now = Date.now()): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && Date.parse(row.expiresAt) <= now) return false;
  return true;
}

export function findMockApiTokenBySecret(
  rows: MockApiTokenRow[],
  token: string,
): MockApiTokenRow | null {
  if (!isApiTokenFormat(token)) return null;
  const hash = hashMockApiToken(token);
  const row = rows.find((r) => r.tokenHash === hash);
  if (!row || !isMockApiTokenActive(row)) return null;
  return row;
}
