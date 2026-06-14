function envFlag(name: string, defaultWhenUnset = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultWhenUnset;
  return raw === "1" || raw === "true" || raw === "yes";
}

function envString(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw || undefined;
}

export function craftApiEnv(): "development" | "production" {
  const raw = envString("CRAFT_API_ENV") ?? envString("NODE_ENV");
  return raw === "production" ? "production" : "development";
}

export function isCraftApiProduction(): boolean {
  return craftApiEnv() === "production";
}

/** When false, /v1/* requires a valid session (except /v1/auth/*). */
export function isAnonAccessAllowed(): boolean {
  return process.env.CRAFT_API_ALLOW_ANON !== "0";
}

export function isRbacEnabledFromEnv(): boolean {
  return process.env.CRAFT_API_RBAC !== "0";
}

export function sessionCookieSecure(): boolean {
  if (envFlag("CRAFT_API_COOKIE_SECURE")) return true;
  return isCraftApiProduction();
}

export function trustProxy(): boolean {
  return envFlag("CRAFT_API_TRUST_PROXY") || isCraftApiProduction();
}

export function corsAllowedOrigins(): string[] | true {
  const raw = envString("CRAFT_API_CORS_ORIGIN");
  if (!raw) {
    return isCraftApiProduction() ? [] : true;
  }
  if (raw === "*") return true;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function validateCraftApiConfig(): string[] {
  const warnings: string[] = [];
  if (isCraftApiProduction() && isAnonAccessAllowed()) {
    warnings.push("CRAFT_API_ALLOW_ANON is enabled in production — set CRAFT_API_ALLOW_ANON=0");
  }
  if (isCraftApiProduction() && corsAllowedOrigins() === true) {
    warnings.push("CRAFT_API_CORS_ORIGIN is unset in production — restrict to your web origin");
  }
  const origins = corsAllowedOrigins();
  if (isCraftApiProduction() && Array.isArray(origins) && origins.length === 0) {
    warnings.push("CRAFT_API_CORS_ORIGIN is empty — browser clients will be blocked by CORS");
  }
  return warnings;
}
