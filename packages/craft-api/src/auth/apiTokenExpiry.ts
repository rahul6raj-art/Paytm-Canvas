export const MAX_API_TOKEN_EXPIRES_DAYS = 365;

export function parseExpiresInDays(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  if (n > MAX_API_TOKEN_EXPIRES_DAYS) return null;
  return n;
}

export function computeTokenExpiresAt(expiresInDays: number | null | undefined, now = Date.now()): Date | null {
  if (expiresInDays == null) return null;
  return new Date(now + expiresInDays * 24 * 60 * 60 * 1000);
}
