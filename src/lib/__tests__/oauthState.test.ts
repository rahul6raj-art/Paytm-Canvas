import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOAuthState, verifyOAuthState } from "@/lib/oauth";

describe("oauth state", () => {
  it("round-trips signed state", () => {
    const state = createOAuthState("google", "/settings/profile");
    const verified = verifyOAuthState(state);
    assert.ok(verified);
    assert.equal(verified?.provider, "google");
    assert.equal(verified?.next, "/settings/profile");
  });

  it("rejects tampered state", () => {
    const state = createOAuthState("github", "/");
    const verified = verifyOAuthState(`${state}x`);
    assert.equal(verified, null);
  });

  it("sanitizes unsafe next paths", () => {
    const state = createOAuthState("google", "//evil.example");
    const verified = verifyOAuthState(state);
    assert.equal(verified?.next, "/");
  });
});
