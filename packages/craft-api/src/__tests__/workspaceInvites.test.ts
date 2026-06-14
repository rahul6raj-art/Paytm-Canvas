import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inviteOutcomeKind,
  normalizeInviteEmail,
} from "../access/workspaceInvites.js";

describe("workspaceInvites", () => {
  it("normalizes invite emails", () => {
    assert.equal(normalizeInviteEmail("  Dev@Paytm.COM "), "dev@paytm.com");
    assert.equal(normalizeInviteEmail(""), null);
    assert.equal(normalizeInviteEmail("not-email"), null);
  });

  it("classifies invite outcomes", () => {
    assert.equal(inviteOutcomeKind(true), "member");
    assert.equal(inviteOutcomeKind(false), "invite");
  });
});
