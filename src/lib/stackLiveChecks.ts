export const STACK_SESSION_COOKIE = "craft_sid";

export type StackLiveConfig = {
  apiBase: string;
  syncHttpBase: string;
  syncWsUrl: string;
  email: string;
  password: string;
  apiToken?: string;
  timeoutMs: number;
};

import { parseV1Data, type V1Envelope } from "@/lib/apiEnvelope";

export type { V1Envelope };
export { parseV1Data } from "@/lib/apiEnvelope";

export function defaultStackLiveConfig(env: NodeJS.ProcessEnv = process.env): StackLiveConfig {
  const apiBase = (env.CRAFT_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const syncHost = (env.CRAFT_SYNC_URL ?? "ws://localhost:4001/yjs")
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:")
    .replace(/\/yjs\/?$/, "");
  return {
    apiBase,
    syncHttpBase: syncHost,
    syncWsUrl: env.CRAFT_SYNC_URL ?? "ws://localhost:4001/yjs",
    email: env.CRAFT_LIVE_EMAIL ?? "rahul.verma@paytm.com",
    password: env.CRAFT_LIVE_PASSWORD ?? "craft-dev",
    apiToken: env.CRAFT_API_TOKEN?.trim() || undefined,
    timeoutMs: Number(env.CRAFT_LIVE_TIMEOUT_MS ?? 8000),
  };
}

export function authHeadersForToken(sessionOrApiToken: string, useBearer: boolean): Record<string, string> {
  if (useBearer) {
    return { Authorization: `Bearer ${sessionOrApiToken}` };
  }
  return { Cookie: cookieHeader(sessionOrApiToken) };
}

export function extractSessionCookie(setCookieHeaders: string | string[] | null | undefined): string | null {
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const raw of headers) {
    const part = raw.split(";")[0]?.trim();
    if (!part?.startsWith(`${STACK_SESSION_COOKIE}=`)) continue;
    const value = part.slice(`${STACK_SESSION_COOKIE}=`.length).trim();
    if (value) return value;
  }
  return null;
}

export function cookieHeader(sessionToken: string): string {
  return `${STACK_SESSION_COOKIE}=${sessionToken}`;
}

export function validateApiHealth(json: unknown): void {
  if (!json || typeof json !== "object") throw new Error("health: invalid JSON");
  const body = json as { ok?: boolean; service?: string };
  if (body.ok !== true) throw new Error("health: ok !== true");
  if (body.service !== "craft-api") throw new Error("health: unexpected service");
}

export function validateRealtimeHttpBody(text: string): void {
  if (!text.includes("Paytm Craft realtime sync")) {
    throw new Error("realtime HTTP: unexpected body");
  }
}

export function validateMeUser(data: unknown): { email: string } {
  if (!data || typeof data !== "object") throw new Error("me: invalid user");
  const user = data as { email?: string };
  if (!user.email) throw new Error("me: missing email");
  return { email: user.email };
}

export function validateWorkspaces(data: unknown): Array<{ id: string; teamId: string }> {
  if (!Array.isArray(data) || data.length === 0) throw new Error("workspaces: expected non-empty array");
  for (const row of data) {
    if (!row || typeof row !== "object") throw new Error("workspaces: invalid row");
    const ws = row as { id?: string; teamId?: string };
    if (!ws.id || !ws.teamId) throw new Error("workspaces: missing id or teamId");
  }
  return data as Array<{ id: string; teamId: string }>;
}

export function validateTeams(data: unknown): Array<{ id: string; slug: string }> {
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error("teams: expected at least two seeded teams");
  }
  return data as Array<{ id: string; slug: string }>;
}

export function validateFiles(data: unknown): Array<{ id: string; workspaceId: string }> {
  if (!Array.isArray(data)) throw new Error("files: expected array");
  return data as Array<{ id: string; workspaceId: string }>;
}

export function realtimeRoomForFile(fileId: string): string {
  return `file:${fileId}`;
}

export function buildSyncJoinPayload(fileId: string, clientId: string, sessionToken?: string): string {
  const payload: Record<string, string> = {
    type: "join",
    room: realtimeRoomForFile(fileId),
    clientId,
  };
  if (sessionToken) payload.sessionToken = sessionToken;
  return JSON.stringify(payload);
}

export function isSyncJoinResponse(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const row = message as { type?: string; room?: string; update?: string };
  return row.type === "sync" && typeof row.room === "string" && typeof row.update === "string";
}

export function unreachableStackMessage(config: StackLiveConfig): string {
  return [
    "Docker stack is not reachable.",
    `Start it with: npm run stack:up && npm run stack:setup`,
    `API: ${config.apiBase}/health`,
    `Sync: ${config.syncHttpBase}`,
  ].join("\n");
}
