import { apiClient, ApiRequestError, type CraftWorkspaceInviteOutcome } from "@/lib/apiClient";

export function validateWorkspaceInviteEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  return trimmed;
}

export async function inviteTeammateToWorkspace(
  workspaceId: string,
  email: string,
): Promise<CraftWorkspaceInviteOutcome> {
  const trimmed = validateWorkspaceInviteEmail(email);
  try {
    return await apiClient.inviteToWorkspace(workspaceId, { email: trimmed, role: "member" });
  } catch (e) {
    if (e instanceof ApiRequestError) throw new Error(e.message);
    throw e;
  }
}

export function workspaceInviteSuccessMessage(
  outcome: CraftWorkspaceInviteOutcome,
  workspaceName: string,
): string {
  if (outcome.kind === "member") {
    return `Added ${outcome.member.email} to ${workspaceName}.`;
  }
  if (outcome.emailSent) {
    return `Invite email sent to ${outcome.invite.email} for ${workspaceName}.`;
  }
  return `Invite saved for ${outcome.invite.email}. They'll join ${workspaceName} when they register.`;
}
