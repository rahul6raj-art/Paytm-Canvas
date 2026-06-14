import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../auth/password.js";

describe("craft-api password", () => {
  it("hashPassword and verifyPassword round-trip", () => {
    const stored = hashPassword("craft-dev-secret");
    assert.ok(stored.startsWith("scrypt:"));
    assert.equal(verifyPassword("craft-dev-secret", stored), true);
    assert.equal(verifyPassword("wrong", stored), false);
  });
});
