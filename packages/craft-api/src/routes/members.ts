import type { WorkspaceRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";
import {
  parseWorkspaceRole,
  requireWorkspaceAccess,
} from "../access/workspaceAccess.js";

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

export const membersRouter = Router({ mergeParams: true });

membersRouter.get("/", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const access = await requireWorkspaceAccess(req, res, workspaceId, "guest");
  if (!access) return;

  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  res.status(200).json(jsonV1Data(rows.map(memberDto)).body);
});

membersRouter.post("/", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const access = await requireWorkspaceAccess(req, res, workspaceId, "admin");
  if (!access) return;

  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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
  if (!user) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "User not found — register first", 404).body);
    return;
  }

  const row = await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    create: { workspaceId, userId: user.id, role },
    update: { role },
    include: { user: true },
  });

  res.status(201).json(jsonV1Data(memberDto(row)).body);
});
