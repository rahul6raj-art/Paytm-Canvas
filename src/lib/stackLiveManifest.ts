/** Live stack script and env documented in docs/live-stack-track.md */
export const LIVE_STACK_SCRIPT = "scripts/verify-stack-live.ts";

export const LIVE_STACK_CONTRACT_SCRIPT = "scripts/verify-stack-live-contract.mjs";

export const LIVE_STACK_ENV_KEYS = [
  "CRAFT_API_URL",
  "CRAFT_SYNC_URL",
  "CRAFT_LIVE_EMAIL",
  "CRAFT_LIVE_PASSWORD",
  "CRAFT_LIVE_TIMEOUT_MS",
  "CRAFT_API_TOKEN",
  "CRAFT_VERIFY_SKIP_LIVE",
] as const;

/** Steps/endpoints exercised by verify:stack:live */
export const LIVE_STACK_SCRIPT_MARKERS = [
  "CRAFT_VERIFY_SKIP_LIVE",
  "defaultStackLiveConfig",
  "/health",
  "/v1/auth/login",
  "/v1/auth/me",
  "/v1/workspaces",
  "/v1/teams",
  "/v1/files",
  "verifyRealtimeHttp",
  "verifyWebSocketJoin",
  "buildSyncJoinPayload",
  "isSyncJoinResponse",
  "CRAFT_API_TOKEN",
] as const;
