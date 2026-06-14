import type { WorkspaceRole } from "@prisma/client";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { effectiveWorkspaceRole } from "./teamAccess.js";
import { jsonV1Error } from "../envelope.js";
import { resolveRequestUser } from "../middleware/auth.js";
import { isRbacEnabled, workspaceRoleAtLeast } from "./workspaceRoles.js";

export { isRbacEnabled, parseWorkspaceRole, workspaceRoleAtLeast } from "./workspaceRoles.js";

export async function getTeamRole(userId: string, teamId: string): Promise<WorkspaceRole | null> {
  const row = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  return row?.role ?? null;
}

export async function getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { teamId: true },
  });
  if (!workspace) return null;

  const [workspaceMember, teamMember] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    }),
    prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: workspace.teamId, userId } },
    }),
  ]);

  return effectiveWorkspaceRole(workspaceMember?.role, teamMember?.role);
}

export async function listTeamsForUser(userId: string) {
  return prisma.team.findMany({
    where: { members: { some: { userId } } },
    orderBy: { name: "asc" },
  });
}

export async function listWorkspacesForUser(userId: string) {
  const [direct, teamRows] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    }),
    prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    }),
  ]);

  const workspaceIds = direct.map((r) => r.workspaceId);
  const teamIds = teamRows.map((r) => r.teamId);
  const orClause = [
    ...(workspaceIds.length > 0 ? [{ id: { in: workspaceIds } }] : []),
    ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
  ];
  if (orClause.length === 0) return [];

  return prisma.workspace.findMany({
    where: { OR: orClause },
    orderBy: { name: "asc" },
  });
}

export async function listAccessibleWorkspaceIds(userId: string): Promise<string[]> {
  const rows = await listWorkspacesForUser(userId);
  return rows.map((w) => w.id);
}

export async function requireTeamAccess(
  req: Request,
  res: Response,
  teamId: string,
  minRole: WorkspaceRole = "guest",
): Promise<{ user: User; role: WorkspaceRole } | null> {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return null;
  }
  if (!isRbacEnabled()) {
    return { user, role: "owner" };
  }
  const role = await getTeamRole(user.id, teamId);
  if (!role || !workspaceRoleAtLeast(role, minRole)) {
    res.status(403).json(jsonV1Error("FORBIDDEN", "Team access denied", 403).body);
    return null;
  }
  return { user, role };
}

export async function requireWorkspaceAccess(
  req: Request,
  res: Response,
  workspaceId: string,
  minRole: WorkspaceRole = "guest",
): Promise<{ user: User; role: WorkspaceRole } | null> {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return null;
  }
  if (!isRbacEnabled()) {
    return { user, role: "owner" };
  }
  const role = await getWorkspaceRole(user.id, workspaceId);
  if (!role || !workspaceRoleAtLeast(role, minRole)) {
    res.status(403).json(jsonV1Error("FORBIDDEN", "Workspace access denied", 403).body);
    return null;
  }
  return { user, role };
}

export async function requireFileAccess(
  req: Request,
  res: Response,
  fileId: string,
  minRole: WorkspaceRole = "guest",
): Promise<{ user: User; role: WorkspaceRole; fileId: string; workspaceId: string } | null> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "File not found", 404).body);
    return null;
  }
  const access = await requireWorkspaceAccess(req, res, file.workspaceId, minRole);
  if (!access) return null;
  return { ...access, fileId: file.id, workspaceId: file.workspaceId };
}
