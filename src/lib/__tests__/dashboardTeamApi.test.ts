import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  craftWorkspaceMemberToMockTeamMember,
  craftWorkspaceMembersToMockMembers,
  craftWorkspaceRoleLabel,
  craftWorkspaceRoleToMockRole,
} from "@/lib/dashboardApiAdapters";
import type { CraftWorkspaceMember } from "@/lib/apiClient";
import { mockApiStore, resetMockApiStoreForTests } from "@/lib/mockApiStore";
import { workspaceInviteSuccessMessage } from "@/lib/workspaceTeamInvite";

describe("dashboardApiAdapters", () => {
  it("maps craft workspace roles to mock sidebar roles", () => {
    assert.equal(craftWorkspaceRoleToMockRole("owner"), "owner");
    assert.equal(craftWorkspaceRoleToMockRole("admin"), "editor");
    assert.equal(craftWorkspaceRoleToMockRole("member"), "editor");
    assert.equal(craftWorkspaceRoleToMockRole("guest"), "viewer");
  });

  it("labels craft workspace roles for the team table", () => {
    assert.equal(craftWorkspaceRoleLabel("admin"), "Admin");
    assert.equal(craftWorkspaceRoleLabel("guest"), "Guest");
  });

  it("converts craft members to mock team rows", () => {
    const row: CraftWorkspaceMember = {
      userId: "u2",
      email: "aisha.khan@paytm.com",
      displayName: "Aisha Khan",
      initials: "AK",
      role: "member",
    };
    const mock = craftWorkspaceMemberToMockTeamMember(row);
    assert.equal(mock.name, "Aisha Khan");
    assert.equal(mock.role, "editor");
    assert.equal(craftWorkspaceMembersToMockMembers([row]).length, 1);
  });
});

describe("workspaceInviteSuccessMessage", () => {
  it("describes member vs pending invite outcomes", () => {
    const memberMsg = workspaceInviteSuccessMessage(
      {
        kind: "member",
        member: {
          userId: "u2",
          email: "aisha@paytm.com",
          displayName: "Aisha",
          initials: "AK",
          role: "member",
        },
      },
      "Paytm Design",
    );
    assert.match(memberMsg, /Added aisha@paytm.com/);

    const inviteMsg = workspaceInviteSuccessMessage(
      {
        kind: "invite",
        invite: {
          id: "inv-1",
          workspaceId: "ws-1",
          email: "new@paytm.com",
          role: "member",
          invitedByUserId: "user-you",
          createdAt: new Date().toISOString(),
        },
        emailSent: true,
      },
      "Experiments",
    );
    assert.match(inviteMsg, /email sent/i);
  });
});

describe("mockApiStore workspace members", () => {
  it("lists seeded members for Paytm Design", () => {
    resetMockApiStoreForTests();
    const members = mockApiStore.listWorkspaceMembers("ws-paytm-design");
    assert.equal(members.length, 4);
    assert.ok(members.some((m) => m.email === "aisha.khan@paytm.com" && m.role === "member"));
  });

  it("invites an existing user by email", () => {
    resetMockApiStoreForTests();
    const before = mockApiStore.listWorkspaceMembers("ws-experiments").length;
    const result = mockApiStore.inviteToWorkspace("ws-experiments", {
      email: "dev.sharma@paytm.com",
      role: "member",
    });
    assert.equal(result.kind, "member");
    const after = mockApiStore.listWorkspaceMembers("ws-experiments");
    assert.equal(after.length, before + 1);
    assert.ok(after.some((m) => m.email === "dev.sharma@paytm.com"));
  });

  it("creates pending invite for unknown email", () => {
    resetMockApiStoreForTests();
    const result = mockApiStore.inviteToWorkspace("ws-personal", { email: "nobody@paytm.com" });
    assert.equal(result.kind, "invite");
    const pending = mockApiStore.listWorkspaceInvites("ws-personal");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]!.email, "nobody@paytm.com");
  });
});
