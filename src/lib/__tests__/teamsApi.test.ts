import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveWorkspaceRole } from "../../../packages/craft-api/src/access/teamAccess.js";
import { mockApiStore, resetMockApiStoreForTests } from "@/lib/mockApiStore";

describe("teams model (client mock store)", () => {
  it("lists seeded teams and members", () => {
    resetMockApiStoreForTests();
    const teams = mockApiStore.listTeams();
    assert.equal(teams.length, 2);
    assert.ok(teams.some((t) => t.slug === "paytm"));
    assert.ok(teams.some((t) => t.slug === "craft-labs"));
    const members = mockApiStore.listTeamMembers("team-paytm");
    assert.ok(members.length >= 4);
  });

  it("workspaces include teamId", () => {
    resetMockApiStoreForTests();
    const ws = mockApiStore.listWorkspaces();
    assert.ok(ws.every((w) => w.teamId === "team-paytm" || w.teamId === "team-labs"));
    assert.ok(ws.some((w) => w.teamId === "team-labs"));
  });
});

describe("effectiveWorkspaceRole", () => {
  it("inherits team role when workspace override missing", () => {
    assert.equal(effectiveWorkspaceRole(undefined, "member"), "member");
  });
});
