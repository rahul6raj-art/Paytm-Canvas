import type { WorkspaceRole } from "@prisma/client";
import { Router } from "express";
import { acceptPendingInvitesForUser, inviteDto } from "../access/acceptWorkspaceInvites.js";
import {
  parseWorkspaceRole,
  requireWorkspaceAccess,
} from "../access/workspaceAccess.js";
import { newWorkspaceInviteId, normalizeInviteEmail } from "../access/workspaceInvites.js";
import { prisma } from "../db.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";
import { sendWorkspaceInviteEmail } from "../mail/sendInviteEmail.js";

function memberDto(row: {
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

export const invitesRouter = Router({ mergeParams: true });

invitesRouter.get("/", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const access = await requireWorkspaceAccess(req, res, workspaceId, "guest");
  if (!access) return;

  const rows = await prisma.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: "asc" },
  });
  res.status(200).json(jsonV1Data(rows.map(inviteDto)).body);
});

invitesRouter.post("/", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const access = await requireWorkspaceAccess(req, res, workspaceId, "admin");
  if (!access) return;

  const body = req.body as Record<string, unknown>;
  const email = normalizeInviteEmail(body.email);
  const role = parseWorkspaceRole(body.role) ?? "member";
  if (!email) {
    res.status(400).json(jsonV1Error("VALIDATION", "email is required", 400).body);
    return;
  }
  if (role === "owner" && access.role !== "owner") {
    res.status(403).json(jsonV1Error("FORBIDDEN", "Only owners can assign owner role", 403).body);
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existingMember) {
      res
        .status(409)
        .json(jsonV1Error("CONFLICT", "User is already a workspace member", 409).body);
      return;
    }

    const row = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      create: { workspaceId, userId: user.id, role },
      update: { role },
      include: { user: true },
    });

    await prisma.workspaceInvite.updateMany({
      where: { workspaceId, email, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });

    res.status(201).json(
      jsonV1Data({
        kind: "member" as const,
        member: memberDto(row),
      }).body,
    );
    return;
  }

  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    create: {
      id: newWorkspaceInviteId(),
      workspaceId,
      email,
      role,
      invitedByUserId: access.user.id,
    },
    update: { role, invitedByUserId: access.user.id, acceptedAt: null },
  });

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  let emailSent = false;
  try {
    emailSent = await sendWorkspaceInviteEmail({
      inviteeEmail: email,
      workspaceName: workspace?.name ?? workspaceId,
      inviterName: access.user.displayName,
      role,
    });
  } catch (e) {
    console.error("[craft-api] invite email failed", email, e);
  }

  res.status(201).json(
    jsonV1Data({
      kind: "invite" as const,
      invite: inviteDto(invite),
      emailSent,
    }).body,
  );
});
