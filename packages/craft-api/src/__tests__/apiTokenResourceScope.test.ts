import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiTokenAllowsHttpRequest,
  apiTokenAllowsRealtimeWrite,
  formatResourceScopesSummary,
  parseApiTokenResourceScopes,
  resolveHttpResourceScope,
  resourceScopesFromLegacyScope,
} from "../auth/apiTokenResourceScope.js";

describe("craft-api apiTokenResourceScope", () => {
  it("parses resource scope arrays", () => {
    assert.deepEqual(parseApiTokenResourceScopes(["files:read", "assets:write"]), [
      "files:read",
      "assets:write",
    ]);
    assert.equal(parseApiTokenResourceScopes("files:read"), null);
    assert.equal(parseApiTokenResourceScopes(["files:admin"]), null);
  });

  it("expands legacy read/write scopes", () => {
    const readScopes = resourceScopesFromLegacyScope("read");
    assert.ok(readScopes.includes("files:read"));
    assert.ok(!readScopes.includes("files:write"));
    assert.ok(readScopes.includes("realtime:write") === false);
    const writeScopes = resourceScopesFromLegacyScope("write");
    assert.ok(writeScopes.includes("files:write"));
    assert.ok(writeScopes.includes("realtime:write"));
  });

  it("maps HTTP paths to resource scopes", () => {
    assert.equal(resolveHttpResourceScope("GET", "/files"), "files:read");
    assert.equal(resolveHttpResourceScope("POST", "/files"), "files:write");
    assert.equal(resolveHttpResourceScope("GET", "/workspaces/ws-1/assets"), "assets:read");
    assert.equal(resolveHttpResourceScope("POST", "/workspaces/ws-1/assets/upload-url"), "assets:write");
    assert.equal(resolveHttpResourceScope("GET", "/me"), null);
  });

  it("enforces granular scopes on HTTP", () => {
    assert.equal(
      apiTokenAllowsHttpRequest("read", ["files:read"], "GET", "/files"),
      true,
    );
    assert.equal(
      apiTokenAllowsHttpRequest("read", ["files:read"], "POST", "/files"),
      false,
    );
    assert.equal(
      apiTokenAllowsHttpRequest("write", ["files:read"], "POST", "/files"),
      false,
    );
    assert.equal(
      apiTokenAllowsHttpRequest("write", ["files:read", "files:write"], "POST", "/files"),
      true,
    );
  });

  it("requires realtime:write for sync writes", () => {
    assert.equal(apiTokenAllowsRealtimeWrite("read", []), false);
    assert.equal(apiTokenAllowsRealtimeWrite("write", []), true);
    assert.equal(apiTokenAllowsRealtimeWrite("write", ["files:read"]), false);
    assert.equal(apiTokenAllowsRealtimeWrite("write", ["realtime:write"]), true);
  });

  it("formats scope summaries for UI", () => {
    assert.match(formatResourceScopesSummary("read", []), /Read-only/);
    assert.equal(formatResourceScopesSummary("write", ["files:read"]), "Files (read)");
    assert.match(formatResourceScopesSummary("write", ["files:read", "assets:read", "comments:read", "teams:read"]), /4 custom/);
  });
});
