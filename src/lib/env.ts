export type PaytmCraftPublicMode = "local" | "api" | "remote";

function readOptionalString(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Public (browser-safe) environment for API / sync / storage wiring.
 * - **local** (default): no HTTP API; editor uses `LocalSyncProvider` and `localStorage`.
 * - **api**: `ApiSyncProvider` — local cache + `/api/v1/files/:id` when a file session is active.
 * - **remote**: `apiClient` calls `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` when set; otherwise mutations throw.
 */
export function getPaytmCraftPublicEnv(): {
  apiUrl: string;
  syncUrl: string;
  storageUrl: string;
  mode: PaytmCraftPublicMode;
} {
  const modeRaw = readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_MODE").toLowerCase();
  let mode: PaytmCraftPublicMode = "local";
  if (modeRaw === "remote") mode = "remote";
  else if (modeRaw === "api") mode = "api";

  return {
    apiUrl: readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_API_URL"),
    syncUrl: readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL"),
    storageUrl: readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL"),
    mode,
  };
}

export function isPaytmCraftApiMode(): boolean {
  return getPaytmCraftPublicEnv().mode === "api";
}

/** True when the app uses HTTP file persistence (`api` mock routes or `remote` API URL). */
export function isPaytmCraftHttpApiMode(): boolean {
  const mode = getPaytmCraftPublicEnv().mode;
  return mode === "api" || mode === "remote";
}

export function isPaytmCraftRemoteMode(): boolean {
  return getPaytmCraftPublicEnv().mode === "remote";
}

/** True when `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` is configured for Yjs/WebSocket sync. */
export function isPaytmCraftRealtimeEnabled(): boolean {
  return getPaytmCraftPublicEnv().syncUrl.length > 0;
}

/** Dev-only canvas debug readout + geometry warnings in the footer. */
export function isPaytmCraftDebugCanvas(): boolean {
  return readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_DEBUG_CANVAS").toLowerCase() === "true";
}
