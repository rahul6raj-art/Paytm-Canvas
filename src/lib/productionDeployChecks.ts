export const PRODUCTION_BACKEND_SECRET_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_PUBLIC_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "CRAFT_API_CORS_ORIGIN",
  "CRAFT_APP_URL",
] as const;

export const PRODUCTION_API_CONFIG_KEYS = [
  "CRAFT_API_ENV",
  "CRAFT_API_ALLOW_ANON",
  "CRAFT_API_COOKIE_SECURE",
  "CRAFT_SYNC_ALLOW_ANON",
] as const;

export const PRODUCTION_SMTP_KEYS = [
  "CRAFT_SMTP_HOST",
  "CRAFT_SMTP_PORT",
  "CRAFT_SMTP_FROM",
  "CRAFT_SMTP_USER",
  "CRAFT_SMTP_PASS",
] as const;

export const PRODUCTION_WEB_PUBLIC_KEYS = [
  "NEXT_PUBLIC_PAYTM_CRAFT_MODE",
  "NEXT_PUBLIC_PAYTM_CRAFT_API_URL",
  "NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL",
  "NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL",
] as const;

export type ProductionEnvKey =
  | (typeof PRODUCTION_BACKEND_SECRET_KEYS)[number]
  | (typeof PRODUCTION_API_CONFIG_KEYS)[number]
  | (typeof PRODUCTION_SMTP_KEYS)[number]
  | (typeof PRODUCTION_WEB_PUBLIC_KEYS)[number]
  | "S3_REGION"
  | "CRAFT_SYNC_ENV";

/** Parse KEY=value lines from an env example file (ignores comments and blanks). */
export function parseEnvExampleKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    keys.add(trimmed.slice(0, eq).trim());
  }
  return keys;
}

export function missingProductionEnvKeys(
  content: string,
  required: readonly string[],
): string[] {
  const present = parseEnvExampleKeys(content);
  return required.filter((k) => !present.has(k));
}

export function looksLikeManagedPostgresUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith("postgresql://") && !u.startsWith("postgres://")) return false;
  return /neon\.tech|amazonaws\.com|rds\.|supabase\.co|render\.com/i.test(u) || u.includes("sslmode=require");
}

export function looksLikeTlsRedisUrl(url: string): boolean {
  return /^rediss:\/\//i.test(url.trim());
}

export function looksLikeR2Endpoint(url: string): boolean {
  return /\.r2\.cloudflarestorage\.com/i.test(url.trim());
}

export function looksLikeHttpsOrigin(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function looksLikeWssSyncUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "wss:";
  } catch {
    return false;
  }
}

export function productionAuthProfileLooksHardened(content: string): boolean {
  const keys = parseEnvExampleKeys(content);
  const get = (key: string) => {
    const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim() ?? "";
  };
  if (!keys.has("CRAFT_API_ALLOW_ANON") || get("CRAFT_API_ALLOW_ANON") !== "0") return false;
  if (!keys.has("CRAFT_SYNC_ALLOW_ANON") || get("CRAFT_SYNC_ALLOW_ANON") !== "0") return false;
  if (!keys.has("CRAFT_API_ENV") || get("CRAFT_API_ENV") !== "production") return false;
  const cors = get("CRAFT_API_CORS_ORIGIN");
  if (!looksLikeHttpsOrigin(cors)) return false;
  const appUrl = get("CRAFT_APP_URL");
  if (!looksLikeHttpsOrigin(appUrl)) return false;
  return true;
}

export function productionWebClientLooksConfigured(content: string): boolean {
  const get = (key: string) => {
    const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim() ?? "";
  };
  if (get("NEXT_PUBLIC_PAYTM_CRAFT_MODE") !== "remote") return false;
  if (!looksLikeHttpsOrigin(get("NEXT_PUBLIC_PAYTM_CRAFT_API_URL"))) return false;
  if (!looksLikeWssSyncUrl(get("NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL"))) return false;
  if (!looksLikeHttpsOrigin(get("NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL"))) return false;
  return true;
}
