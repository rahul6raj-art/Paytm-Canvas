import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWorkspaceRole, workspaceRoleAtLeast } from "../access/workspaceRoles.js";

describe("craft-api workspaceAccess", () => {
  it("workspaceRoleAtLeast compares role ranks", () => {
    assert.equal(workspaceRoleAtLeast("owner", "guest"), true);
    assert.equal(workspaceRoleAtLeast("guest", "member"), false);
    assert.equal(workspaceRoleAtLeast("admin", "member"), true);
  });

  it("parseWorkspaceRole accepts API and mock aliases", () => {
    assert.equal(parseWorkspaceRole("member"), "member");
    assert.equal(parseWorkspaceRole("editor"), "member");
    assert.equal(parseWorkspaceRole("viewer"), "guest");
    assert.equal(parseWorkspaceRole("invalid"), null);
  });
});
