import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateBridgeAuth } from "../auth";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/craft-bridge/status", { headers });
}

describe("craftBridge auth", () => {
  const prev = { ...process.env };

  it("allows when auth not required", () => {
    process.env.CRAFT_BRIDGE_REQUIRE_AUTH = "0";
    process.env.NODE_ENV = "production";
    delete process.env.CRAFT_BRIDGE_TOKEN;
    const r = validateBridgeAuth(req({}));
    assert.equal(r.ok, true);
    Object.assign(process.env, prev);
  });

  it("rejects missing token when auth required", () => {
    process.env.CRAFT_BRIDGE_REQUIRE_AUTH = "1";
    process.env.CRAFT_BRIDGE_TOKEN = "secret";
    const r = validateBridgeAuth(req({}));
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    Object.assign(process.env, prev);
  });

  it("accepts bearer token", () => {
    process.env.CRAFT_BRIDGE_REQUIRE_AUTH = "1";
    process.env.CRAFT_BRIDGE_TOKEN = "secret";
    const r = validateBridgeAuth(req({ authorization: "Bearer secret" }));
    assert.equal(r.ok, true);
    Object.assign(process.env, prev);
  });
});
