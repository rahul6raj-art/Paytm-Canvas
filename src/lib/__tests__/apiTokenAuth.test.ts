import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { API_TOKEN_PREFIX, authorizationBearerHeader, isApiTokenFormat, parseBearerToken } from "@/lib/apiTokenAuth";

describe("apiTokenAuth", () => {
  it("parses and formats bearer tokens", () => {
    assert.equal(parseBearerToken("Bearer craft_pat_xyz"), "craft_pat_xyz");
    assert.equal(authorizationBearerHeader("craft_pat_xyz"), "Bearer craft_pat_xyz");
    assert.equal(isApiTokenFormat(`${API_TOKEN_PREFIX}${"a".repeat(20)}`), true);
  });
});
