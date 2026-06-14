import type { WorkspaceRole } from "@prisma/client";

export function effectiveWorkspaceRole(
  workspaceOverride: WorkspaceRole | null | undefined,
  teamRole: WorkspaceRole | null | undefined,
): WorkspaceRole | null {
  return workspaceOverride ?? teamRole ?? null;
}
