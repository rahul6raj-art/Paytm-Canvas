import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiTokenAllowsHttpMethod,
  apiTokenAllowsRealtimeWrite,
  apiTokenScopeLabel,
  parseApiTokenScope,
} from "../auth/apiTokenScope.js";

describe("craft-api apiTokenScope", () => {
  it("parses read and write scopes", () => {
    assert.equal(parseApiTokenScope("read"), "read");
    assert.equal(parseApiTokenScope("write"), "write");
    assert.equal(parseApiTokenScope("admin"), null);
  });

  it("labels scopes for UI", () => {
    assert.equal(apiTokenScopeLabel("read"), "Read-only");
    assert.equal(apiTokenScopeLabel("write"), "Read & write");
  });

  it("allows GET for read tokens and blocks POST", () => {
    assert.equal(apiTokenAllowsHttpMethod("read", "GET"), true);
    assert.equal(apiTokenAllowsHttpMethod("read", "POST"), false);
    assert.equal(apiTokenAllowsHttpMethod("write", "DELETE"), true);
  });

  it("blocks realtime writes for read tokens", () => {
    assert.equal(apiTokenAllowsRealtimeWrite("read"), false);
    assert.equal(apiTokenAllowsRealtimeWrite("write"), true);
  });
});
