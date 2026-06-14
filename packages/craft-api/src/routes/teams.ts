import type { WorkspaceRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";
import { listTeamsForUser, requireTeamAccess } from "../access/workspaceAccess.js";
import { resolveRequestUser } from "../middleware/auth.js";
import { isRbacEnabled } from "../access/workspaceRoles.js";

function teamMemberDto(row: {
  userId: string;
  role: WorkspaceRole;
  user: { email: string; displayName: string };
}) {
  const parts = row.user.displayName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "??");
  return {
    userId: row.userId,
    email: row.user.email,
    displayName: row.user.displayName,
    initials,
    role: row.role,
  };
}

export const teamsRouter = Router();

teamsRouter.get("/", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return;
  }
  const rows = isRbacEnabled()
    ? await listTeamsForUser(user.id)
    : await prisma.team.findMany({ orderBy: { name: "asc" } });
  res.status(200).json(
    jsonV1Data(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      })),
    ).body,
  );
});

teamsRouter.get("/:teamId/members", async (req, res) => {
  const teamId = String(req.params.teamId ?? "").trim();
  const access = await requireTeamAccess(req, res, teamId, "guest");
  if (!access) return;

  const rows = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  res.status(200).json(jsonV1Data(rows.map(teamMemberDto)).body);
});
