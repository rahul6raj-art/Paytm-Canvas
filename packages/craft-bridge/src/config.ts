export function isCraftBridgeEnabled(): boolean {
  const raw = process.env.CRAFT_BRIDGE_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  return process.env.NODE_ENV === "development";
}

export function isBridgeAuthRequired(): boolean {
  const raw = process.env.CRAFT_BRIDGE_REQUIRE_AUTH?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return process.env.NODE_ENV === "production";
}

export function bridgeAuthToken(): string | undefined {
  return process.env.CRAFT_BRIDGE_TOKEN?.trim() || undefined;
}

export function craftBridgeStoreDir(): string {
  return process.env.CRAFT_BRIDGE_STORE_DIR?.trim() || ".craft-bridge";
}

export function defaultCraftUrl(): string {
  return process.env.CRAFT_BRIDGE_URL?.trim() || "http://localhost:3000";
}

/** Comma-separated absolute repo roots allowed for read/write (production guard). */
export function allowedRepoRoots(): string[] {
  const raw = process.env.CRAFT_BRIDGE_ALLOWED_REPO_ROOTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
