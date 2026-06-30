import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSyncJoinPayload,
  defaultStackLiveConfig,
  extractSessionCookie,
  authHeadersForToken,
  cookieHeader,
  isSyncJoinResponse,
  parseV1Data,
  realtimeRoomForFile,
  validateApiHealth,
  validateMeUser,
  validateRealtimeHttpBody,
  validateTeams,
  validateWorkspaces,
} from "@/lib/stackLiveChecks";

describe("stackLiveChecks", () => {
  it("defaults local stack URLs", () => {
    const config = defaultStackLiveConfig({});
    assert.equal(config.apiBase, "http://localhost:4000");
    assert.equal(config.syncWsUrl, "ws://localhost:4001/yjs");
    assert.equal(config.email, "demo@paytm.com");
  });

  it("parses v1 data envelope", () => {
    const data = parseV1Data<{ id: string }>({ data: { id: "user-you" } });
    assert.equal(data.id, "user-you");
    assert.throws(() => parseV1Data({ error: { code: "UNAUTHORIZED", message: "nope" } }));
  });

  it("extracts craft_sid from Set-Cookie", () => {
    const token = extractSessionCookie(["craft_sid=abc123; Path=/; HttpOnly"]);
    assert.equal(token, "abc123");
    assert.equal(cookieHeader("abc123"), "craft_sid=abc123");
  });

  it("validates health and realtime bodies", () => {
    validateApiHealth({ ok: true, service: "craft-api" });
    validateRealtimeHttpBody("Paytm Craft realtime sync (Postgres-backed)\n");
  });

  it("validates seeded workspace and team shapes", () => {
    validateMeUser({ email: "demo@paytm.com" });
    const ws = validateWorkspaces([{ id: "ws-personal", teamId: "team-paytm", name: "Personal", slug: "personal" }]);
    assert.equal(ws[0]!.id, "ws-personal");
    const teams = validateTeams([
      { id: "team-paytm", name: "Paytm", slug: "paytm" },
      { id: "team-labs", name: "Craft Labs", slug: "craft-labs" },
    ]);
    assert.equal(teams.length, 2);
  });

  it("builds auth headers for cookie or bearer", () => {
    assert.deepEqual(authHeadersForToken("abc", false), { Cookie: "craft_sid=abc" });
    assert.deepEqual(authHeadersForToken("craft_pat_x", true), { Authorization: "Bearer craft_pat_x" });
  });

  it("builds websocket join payloads", () => {
    assert.equal(realtimeRoomForFile("api-file-paytm-1"), "file:api-file-paytm-1");
    const raw = buildSyncJoinPayload("api-file-paytm-1", "smoke-1", "tok");
    const parsed = JSON.parse(raw) as { type: string; sessionToken?: string };
    assert.equal(parsed.type, "join");
    assert.equal(parsed.sessionToken, "tok");
    assert.equal(isSyncJoinResponse({ type: "sync", room: "file:x", update: "AA==" }), true);
  });
});
