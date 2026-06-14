import { randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { hashSessionToken } from "./password.js";
import {
  apiTokenDisplayPrefix,
  isApiTokenFormat,
  newApiTokenSecret,
} from "./apiTokenFormat.js";
import { computeTokenExpiresAt, parseExpiresInDays, MAX_API_TOKEN_EXPIRES_DAYS } from "./apiTokenExpiry.js";
import { parseApiTokenScope, type ApiTokenScope } from "./apiTokenScope.js";
import {
  parseApiTokenResourceScopes,
  type ApiTokenResourceScope,
} from "./apiTokenResourceScope.js";

export { parseBearerToken, isApiTokenFormat, API_TOKEN_PREFIX } from "./apiTokenFormat.js";
export type { ApiTokenScope } from "./apiTokenScope.js";
export type { ApiTokenResourceScope } from "./apiTokenResourceScope.js";

function normalizeResourceScopes(raw: string[]): ApiTokenResourceScope[] {
  const parsed = parseApiTokenResourceScopes(raw);
  return parsed ?? [];
}

export function apiTokenDto(row: {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: ApiTokenScope;
  resourceScopes: string[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scope: row.scope,
    resourceScopes: normalizeResourceScopes(row.resourceScopes),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

export async function createApiToken(
  userId: string,
  name: string,
  expiresInDays?: number | null,
  scope: ApiTokenScope = "write",
  resourceScopes: ApiTokenResourceScope[] = [],
): Promise<{ row: ReturnType<typeof apiTokenDto>; token: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("token name required");
  const parsedDays = expiresInDays == null ? null : parseExpiresInDays(expiresInDays);
  if (expiresInDays != null && parsedDays == null) {
    throw new Error(`expiresInDays must be 1–${MAX_API_TOKEN_EXPIRES_DAYS}`);
  }

  const token = newApiTokenSecret();
  const row = await prisma.apiToken.create({
    data: {
      id: `pat-${randomBytes(8).toString("hex")}`,
      userId,
      name: trimmed,
      tokenHash: hashSessionToken(token),
      tokenPrefix: apiTokenDisplayPrefix(token),
      scope,
      resourceScopes,
      expiresAt: computeTokenExpiresAt(parsedDays),
    },
  });
  return { row: apiTokenDto(row), token };
}

export async function listApiTokensForUser(userId: string) {
  const rows = await prisma.apiToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(apiTokenDto);
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const row = await prisma.apiToken.findFirst({
    where: { id: tokenId, userId, revokedAt: null },
  });
  if (!row) return false;
  await prisma.apiToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return true;
}

export async function findApiTokenAuth(
  token: string,
): Promise<{ user: User; scope: ApiTokenScope; resourceScopes: ApiTokenResourceScope[] } | null> {
  if (!isApiTokenFormat(token)) return null;
  const row = await prisma.apiToken.findFirst({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  await prisma.apiToken
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);
  return {
    user: row.user,
    scope: row.scope,
    resourceScopes: normalizeResourceScopes(row.resourceScopes),
  };
}

export async function findUserByApiToken(token: string): Promise<User | null> {
  const auth = await findApiTokenAuth(token);
  return auth?.user ?? null;
}
