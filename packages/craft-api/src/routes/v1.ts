import type { Comment, File, FileVersion, User, Workspace } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { jsonV1Data, jsonV1Error, nextRevision } from "../envelope.js";
import {
  isRbacEnabled,
  listAccessibleWorkspaceIds,
  listWorkspacesForUser,
  requireFileAccess,
  requireWorkspaceAccess,
} from "../access/workspaceAccess.js";
import { resolveRequestUser, userDto } from "../middleware/auth.js";

function fileSummary(row: File) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  };
}

function fileDetail(row: File) {
  return {
    ...fileSummary(row),
    createdAt: row.createdAt.toISOString(),
    documentJson: row.documentJson,
  };
}

function commentDto(row: Comment) {
  return {
    id: row.id,
    fileId: row.fileId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    resolved: row.resolved,
    ...(row.x != null ? { x: row.x } : {}),
    ...(row.y != null ? { y: row.y } : {}),
    ...(row.parentNodeId ? { parentNodeId: row.parentNodeId } : {}),
    ...(row.frameId ? { frameId: row.frameId } : {}),
  };
}

async function requireUser(req: import("express").Request, res: import("express").Response) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return null;
  }
  return user;
}

async function fileVersionListDto(row: FileVersion, author: User) {
  return {
    id: row.id,
    fileId: row.fileId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    createdByDisplayName: author.displayName,
  };
}

export const v1Router = Router();

v1Router.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

v1Router.get("/me", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return;
  }
  res.status(200).json(jsonV1Data(userDto(user)).body);
});

v1Router.get("/workspaces", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return;
  }
  const rows = isRbacEnabled()
    ? await listWorkspacesForUser(user.id)
    : await prisma.workspace.findMany({ orderBy: { name: "asc" } });
  res.status(200).json(
    jsonV1Data(
      rows.map((w: Workspace) => ({
        id: w.id,
        teamId: w.teamId,
        name: w.name,
        slug: w.slug,
      })),
    ).body,
  );
});

v1Router.get("/files", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return;
  }

  const workspaceId = String(req.query.workspaceId ?? "").trim() || undefined;
  if (workspaceId) {
    const access = await requireWorkspaceAccess(req, res, workspaceId, "guest");
    if (!access) return;
  }

  const accessibleIds = isRbacEnabled() ? await listAccessibleWorkspaceIds(user.id) : undefined;
  const rows = await prisma.file.findMany({
    where: workspaceId
      ? { workspaceId }
      : accessibleIds
        ? { workspaceId: { in: accessibleIds } }
        : undefined,
    orderBy: { updatedAt: "desc" },
  });
  res.status(200).json(jsonV1Data(rows.map(fileSummary)).body);
});

v1Router.post("/files", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!workspaceId || !name) {
    res.status(400).json(jsonV1Error("VALIDATION_ERROR", "workspaceId and name are required", 400).body);
    return;
  }
  const access = await requireWorkspaceAccess(req, res, workspaceId, "member");
  if (!access) return;
  const hasDoc = Object.prototype.hasOwnProperty.call(body, "documentJson");
  const id = `api-file-${Date.now()}`;
  const row = await prisma.file.create({
    data: {
      id,
      workspaceId,
      name,
      documentJson: hasDoc ? (body.documentJson as object) : emptyDocument(name),
      revision: "1",
    },
  });
  res.status(201).json(jsonV1Data(fileSummary(row)).body);
});

v1Router.get("/files/:fileId", async (req, res) => {
  const access = await requireFileAccess(req, res, req.params.fileId, "guest");
  if (!access) return;
  const row = await prisma.file.findUnique({ where: { id: access.fileId } });
  if (!row) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "File not found", 404).body);
    return;
  }
  res.status(200).json(jsonV1Data(fileDetail(row)).body);
});

v1Router.put("/files/:fileId", async (req, res) => {
  const access = await requireFileAccess(req, res, req.params.fileId, "member");
  if (!access) return;
  const fileId = access.fileId;
  const body = req.body as Record<string, unknown>;
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasDoc = Object.prototype.hasOwnProperty.call(body, "documentJson");
  if (!hasName && !hasDoc) {
    res.status(400).json(jsonV1Error("VALIDATION_ERROR", "Provide at least one of: name, documentJson", 400).body);
    return;
  }
  if (hasName && (typeof body.name !== "string" || !body.name.trim())) {
    res.status(400).json(jsonV1Error("VALIDATION_ERROR", "name must be a non-empty string when provided", 400).body);
    return;
  }
  const cur = await prisma.file.findUnique({ where: { id: fileId } });
  if (!cur) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "File not found", 404).body);
    return;
  }
  const ifMatch = req.header("If-Match")?.trim();
  if (ifMatch !== undefined && ifMatch !== cur.revision) {
    res
      .status(409)
      .json(jsonV1Error("CONFLICT", `Revision mismatch (server has revision ${cur.revision})`, 409).body);
    return;
  }
  const row = await prisma.file.update({
    where: { id: fileId },
    data: {
      name: hasName ? (body.name as string).trim() : undefined,
      documentJson: hasDoc ? (body.documentJson as object) : undefined,
      revision: nextRevision(cur.revision),
    },
  });
  res.status(200).json(jsonV1Data(fileDetail(row)).body);
});

v1Router.get("/comments", async (req, res) => {
  const fileId = String(req.query.fileId ?? "").trim();
  if (!fileId) {
    res.status(400).json(jsonV1Error("VALIDATION_ERROR", "fileId is required", 400).body);
    return;
  }
  const access = await requireFileAccess(req, res, fileId, "guest");
  if (!access) return;
  const rows = await prisma.comment.findMany({
    where: { fileId },
    orderBy: { createdAt: "asc" },
  });
  res.status(200).json(jsonV1Data(rows.map(commentDto)).body);
});

v1Router.post("/comments", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
  if (!fileId) {
    res.status(400).json(jsonV1Error("VALIDATION_ERROR", "fileId is required", 400).body);
    return;
  }
  const access = await requireFileAccess(req, res, fileId, "member");
  if (!access) return;
  const row = await prisma.comment.create({
    data: {
      id: `api-comment-${Date.now()}`,
      fileId,
      body: typeof body.body === "string" ? body.body.trim() : "",
      x: typeof body.x === "number" ? body.x : undefined,
      y: typeof body.y === "number" ? body.y : undefined,
      parentNodeId: typeof body.parentNodeId === "string" ? body.parentNodeId : undefined,
      frameId: typeof body.frameId === "string" ? body.frameId : undefined,
    },
  });
  res.status(201).json(jsonV1Data(commentDto(row)).body);
});

v1Router.patch("/comments/:commentId", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const cur = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
  if (!cur) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "Comment not found", 404).body);
    return;
  }
  const access = await requireFileAccess(req, res, cur.fileId, "member");
  if (!access) return;
  const row = await prisma.comment.update({
    where: { id: req.params.commentId },
    data: {
      body: typeof body.body === "string" ? body.body.trim() : undefined,
      resolved: typeof body.resolved === "boolean" ? body.resolved : undefined,
    },
  });
  res.status(200).json(jsonV1Data(commentDto(row)).body);
});

v1Router.delete("/comments/:commentId", async (req, res) => {
  const cur = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
  if (!cur) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "Comment not found", 404).body);
    return;
  }
  const access = await requireFileAccess(req, res, cur.fileId, "member");
  if (!access) return;
  await prisma.comment.delete({ where: { id: req.params.commentId } });
  res.status(200).json(jsonV1Data({ deleted: true }).body);
});

v1Router.get("/files/:fileId/versions", async (req, res) => {
  const access = await requireFileAccess(req, res, req.params.fileId, "guest");
  if (!access) return;
  const rows = await prisma.fileVersion.findMany({
    where: { fileId: access.fileId },
    orderBy: { createdAt: "desc" },
    include: { author: true },
  });
  res.status(200).json(
    jsonV1Data(rows.map((r) => fileVersionListDto(r, r.author))).body,
  );
});

v1Router.post("/files/:fileId/versions", async (req, res) => {
  const access = await requireFileAccess(req, res, req.params.fileId, "member");
  if (!access) return;
  const fileId = access.fileId;
  const body = req.body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(body, "documentJson")) {
    res.status(400).json(jsonV1Error("VALIDATION_ERROR", "documentJson is required", 400).body);
    return;
  }
  const user = await requireUser(req, res);
  if (!user) return;
  const now = new Date();
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : `Version ${now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  const row = await prisma.fileVersion.create({
    data: {
      id: `api-ver-${Date.now()}`,
      fileId,
      name,
      documentJson: body.documentJson as object,
      createdByUserId: user.id,
    },
    include: { author: true },
  });
  res.status(201).json(jsonV1Data(fileVersionListDto(row, row.author)).body);
});

v1Router.get("/files/:fileId/versions/:versionId", async (req, res) => {
  const access = await requireFileAccess(req, res, req.params.fileId, "guest");
  if (!access) return;
  const row = await prisma.fileVersion.findFirst({
    where: { id: req.params.versionId, fileId: access.fileId },
    include: { author: true },
  });
  if (!row) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "Version not found", 404).body);
    return;
  }
  res.status(200).json(
    jsonV1Data({
      ...fileVersionListDto(row, row.author),
      documentJson: row.documentJson,
    }).body,
  );
});

v1Router.post("/files/:fileId/versions/:versionId/restore", async (req, res) => {
  const access = await requireFileAccess(req, res, req.params.fileId, "member");
  if (!access) return;
  const { fileId, versionId } = { fileId: access.fileId, versionId: req.params.versionId };
  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId } });
  if (!version) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "File or version not found", 404).body);
    return;
  }
  const cur = await prisma.file.findUnique({ where: { id: fileId } });
  if (!cur) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "File not found", 404).body);
    return;
  }
  const row = await prisma.file.update({
    where: { id: fileId },
    data: {
      documentJson: version.documentJson,
      revision: nextRevision(cur.revision),
    },
  });
  res.status(200).json(jsonV1Data(fileDetail(row)).body);
});

function emptyDocument(name: string) {
  return {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    nodes: {},
    childOrder: { __root__: [] },
    selectedIds: [],
    comments: [],
  };
}
