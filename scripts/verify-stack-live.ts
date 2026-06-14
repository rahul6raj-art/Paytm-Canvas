#!/usr/bin/env tsx
/**
 * Live smoke test against a running Docker stack (craft-api + craft-realtime).
 * Requires: npm run stack:up && npm run stack:setup
 */
import WebSocket from "ws";
import {
  buildSyncJoinPayload,
  defaultStackLiveConfig,
  extractSessionCookie,
  authHeadersForToken,
  isSyncJoinResponse,
  parseV1Data,
  unreachableStackMessage,
  validateApiHealth,
  validateFiles,
  validateMeUser,
  validateRealtimeHttpBody,
  validateTeams,
  validateWorkspaces,
  type StackLiveConfig,
} from "../src/lib/stackLiveChecks";
import { isApiTokenFormat } from "../src/lib/apiTokenAuth";

function log(step: string) {
  console.log(`[verify:stack:live] ${step}`);
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function assertReachable(config: StackLiveConfig): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${config.apiBase}/health`, undefined, config.timeoutMs);
    if (!res.ok) throw new Error(`health status ${res.status}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`${unreachableStackMessage(config)}\n(${detail})`);
  }
}

async function login(config: StackLiveConfig): Promise<string> {
  const res = await fetchWithTimeout(
    `${config.apiBase}/v1/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: config.email, password: config.password }),
    },
    config.timeoutMs,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`login failed (${res.status}): ${body}`);
  }
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : res.headers.get("set-cookie");
  const token = extractSessionCookie(setCookie);
  if (!token) throw new Error("login: missing craft_sid cookie");
  parseV1Data(await res.json());
  return token;
}

async function authedGet<T>(
  config: StackLiveConfig,
  path: string,
  authToken: string,
  useBearer: boolean,
): Promise<T> {
  const res = await fetchWithTimeout(
    `${config.apiBase}${path}`,
    { headers: authHeadersForToken(authToken, useBearer) },
    config.timeoutMs,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} failed (${res.status}): ${body}`);
  }
  return parseV1Data<T>(await res.json());
}

async function resolveAuth(config: StackLiveConfig): Promise<{ token: string; useBearer: boolean }> {
  if (config.apiToken) {
    if (!isApiTokenFormat(config.apiToken)) {
      throw new Error("CRAFT_API_TOKEN must start with craft_pat_");
    }
    return { token: config.apiToken, useBearer: true };
  }
  return { token: await login(config), useBearer: false };
}

async function verifyRealtimeHttp(config: StackLiveConfig): Promise<void> {
  const res = await fetchWithTimeout(config.syncHttpBase, undefined, config.timeoutMs);
  if (!res.ok) throw new Error(`realtime HTTP status ${res.status}`);
  validateRealtimeHttpBody(await res.text());
}

async function verifyWebSocketJoin(config: StackLiveConfig, fileId: string, sessionToken: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(config.syncWsUrl);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("websocket join timed out"));
    }, config.timeoutMs);

    const fail = (err: unknown) => {
      clearTimeout(timer);
      ws.terminate();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    ws.on("error", fail);
    ws.on("open", () => {
      ws.send(buildSyncJoinPayload(fileId, "verify-stack-live", sessionToken));
    });
    ws.on("message", (data) => {
      try {
        const raw = typeof data === "string" ? data : data.toString();
        const message: unknown = JSON.parse(raw);
        if (isSyncJoinResponse(message)) {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch (e) {
        fail(e);
      }
    });
  });
}

async function main() {
  if (process.env.CRAFT_VERIFY_SKIP_LIVE === "1") {
    log("skipped (CRAFT_VERIFY_SKIP_LIVE=1)");
    return;
  }

  const config = defaultStackLiveConfig();
  log("reachability");
  await assertReachable(config);

  log("API /health");
  const healthRes = await fetchWithTimeout(`${config.apiBase}/health`, undefined, config.timeoutMs);
  validateApiHealth(await healthRes.json());

  log("auth");
  const { token: authToken, useBearer } = await resolveAuth(config);
  if (useBearer) log("using CRAFT_API_TOKEN bearer auth");
  else log("session cookie from login");

  log("GET /v1/auth/me");
  const me = await authedGet<unknown>(config, "/v1/auth/me", authToken, useBearer);
  const { email } = validateMeUser(me);
  if (!useBearer && email !== config.email) {
    throw new Error(`me: expected ${config.email}, got ${email}`);
  }

  log("GET /v1/workspaces");
  const workspaces = validateWorkspaces(await authedGet<unknown>(config, "/v1/workspaces", authToken, useBearer));

  log("GET /v1/teams");
  validateTeams(await authedGet<unknown>(config, "/v1/teams", authToken, useBearer));

  const workspaceId = workspaces[0]!.id;
  log(`GET /v1/files?workspaceId=${workspaceId}`);
  const files = validateFiles(
    await authedGet<unknown>(config, `/v1/files?workspaceId=${encodeURIComponent(workspaceId)}`, authToken, useBearer),
  );
  const fileId = files[0]?.id ?? "api-file-paytm-1";

  log("realtime HTTP");
  await verifyRealtimeHttp(config);

  log(`websocket join file:${fileId}`);
  await verifyWebSocketJoin(config, fileId, authToken);

  log("ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
