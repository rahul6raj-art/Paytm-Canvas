import type { WorkspaceRole } from "@prisma/client";
import { isRbacEnabledFromEnv } from "../config.js";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  guest: 1,
};

export function isRbacEnabled(): boolean {
  return isRbacEnabledFromEnv();
}

export function workspaceRoleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function parseWorkspaceRole(raw: unknown): WorkspaceRole | null {
  if (raw === "owner" || raw === "admin" || raw === "member" || raw === "guest") return raw;
  if (raw === "editor") return "member";
  if (raw === "viewer") return "guest";
  return null;
}
