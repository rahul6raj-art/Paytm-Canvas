import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { API_TOKEN_PREFIX } from "@/lib/apiTokenAuth";
import { mockApiTokenGuard, resolveMockApiRequestAuth } from "@/lib/mockApiRequestAuth";
import { mockApiStore, resetMockApiStoreForTests } from "@/lib/mockApiStore";
import { mockApiTokenAllowsHttp } from "@/lib/mockApiTokenScope";

describe("mockApiTokens", () => {
  it("creates, lists, and revokes tokens for the mock user", () => {
    resetMockApiStoreForTests();
    const created = mockApiStore.createApiToken({ name: "CI exporter", scope: "read" });
    assert.match(created.token, new RegExp(`^${API_TOKEN_PREFIX}`));
    assert.equal(created.row.name, "CI exporter");
    assert.equal(created.row.scope, "read");

    const listed = mockApiStore.listApiTokens();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.row.id);

    const user = mockApiStore.getCurrentUser();
    assert.equal(mockApiStore.revokeApiToken(user.id, created.row.id), true);
    assert.equal(mockApiStore.listApiTokens().length, 0);
  });

  it("stores custom resource scopes", () => {
    resetMockApiStoreForTests();
    const created = mockApiStore.createApiToken({
      name: "Exporter",
      scope: "write",
      resourceScopes: ["files:read", "assets:read"],
    });
    assert.deepEqual(created.row.resourceScopes, ["files:read", "assets:read"]);
  });

  it("resolves bearer auth and enforces granular scopes on mock routes", () => {
    resetMockApiStoreForTests();
    const created = mockApiStore.createApiToken({
      name: "Read files only",
      scope: "write",
      resourceScopes: ["files:read"],
    });

    const getReq = new Request("http://localhost/api/v1/files", {
      headers: { Authorization: `Bearer ${created.token}` },
    });
    const auth = resolveMockApiRequestAuth(getReq);
    assert.equal(auth.kind, "api_token");
    assert.equal(mockApiTokenGuard(getReq, "GET", { read: "files:read", write: "files:write" }), null);

    const postReq = new Request("http://localhost/api/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${created.token}` },
    });
    const denied = mockApiTokenGuard(postReq, "POST", { read: "files:read", write: "files:write" });
    assert.ok(denied);
    assert.equal(denied?.status, 403);
    assert.equal(
      mockApiTokenAllowsHttp("write", ["files:read"], "files:write"),
      false,
    );
  });

  it("falls back to session auth when no bearer token is present", () => {
    resetMockApiStoreForTests();
    const auth = resolveMockApiRequestAuth(new Request("http://localhost/api/v1/me"));
    assert.equal(auth.kind, "session");
    assert.equal(auth.user.email, mockApiStore.getCurrentUser().email);
  });
});
