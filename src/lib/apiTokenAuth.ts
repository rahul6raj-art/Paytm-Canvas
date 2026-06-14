export const API_TOKEN_PREFIX = "craft_pat_";

export function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function isApiTokenFormat(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX) && token.length >= API_TOKEN_PREFIX.length + 16;
}

export function authorizationBearerHeader(token: string): string {
  return `Bearer ${token}`;
}
