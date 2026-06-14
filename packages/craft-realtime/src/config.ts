function envString(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw || undefined;
}

export function craftSyncEnv(): "development" | "production" {
  const raw = envString("CRAFT_SYNC_ENV") ?? envString("NODE_ENV");
  return raw === "production" ? "production" : "development";
}

export function isCraftSyncProduction(): boolean {
  return craftSyncEnv() === "production";
}

export function isSyncAnonAllowed(): boolean {
  return process.env.CRAFT_SYNC_ALLOW_ANON !== "0";
}

export function validateCraftSyncConfig(): string[] {
  const warnings: string[] = [];
  if (isCraftSyncProduction() && isSyncAnonAllowed()) {
    warnings.push("CRAFT_SYNC_ALLOW_ANON is enabled in production — set CRAFT_SYNC_ALLOW_ANON=0");
  }
  return warnings;
}
