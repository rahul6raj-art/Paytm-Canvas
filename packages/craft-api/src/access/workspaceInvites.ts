export function normalizeInviteEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

export function newWorkspaceInviteId(): string {
  return `ws-inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function inviteOutcomeKind(userExists: boolean): "member" | "invite" {
  return userExists ? "member" : "invite";
}
