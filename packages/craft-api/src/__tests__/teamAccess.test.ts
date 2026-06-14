import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveWorkspaceRole } from "../access/teamAccess.js";

describe("teamAccess", () => {
  it("prefers workspace override over team role", () => {
    assert.equal(effectiveWorkspaceRole("guest", "admin"), "guest");
    assert.equal(effectiveWorkspaceRole(null, "member"), "member");
    assert.equal(effectiveWorkspaceRole(undefined, "owner"), "owner");
    assert.equal(effectiveWorkspaceRole(null, null), null);
  });
});
