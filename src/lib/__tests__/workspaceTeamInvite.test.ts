import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateWorkspaceInviteEmail, workspaceInviteSuccessMessage } from "@/lib/workspaceTeamInvite";

describe("workspaceTeamInvite", () => {
  it("rejects empty or invalid emails", () => {
    assert.throws(() => validateWorkspaceInviteEmail(""), /valid email/);
    assert.throws(() => validateWorkspaceInviteEmail("not-an-email"), /valid email/);
  });

  it("returns trimmed email", () => {
    assert.equal(validateWorkspaceInviteEmail("  dev@paytm.com  "), "dev@paytm.com");
  });

  it("formats pending invite success copy", () => {
    const msg = workspaceInviteSuccessMessage(
      {
        kind: "invite",
        invite: {
          id: "x",
          workspaceId: "ws-1",
          email: "new@paytm.com",
          role: "member",
          invitedByUserId: "u1",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        emailSent: true,
      },
      "Personal",
    );
    assert.match(msg, /email sent/i);
  });

  it("notes when invite is pending without email delivery", () => {
    const msg = workspaceInviteSuccessMessage(
      {
        kind: "invite",
        invite: {
          id: "x",
          workspaceId: "ws-1",
          email: "new@paytm.com",
          role: "member",
          invitedByUserId: "u1",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      },
      "Personal",
    );
    assert.match(msg, /saved for/);
  });
});
