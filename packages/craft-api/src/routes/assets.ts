import type { Asset } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db.js";
import { requireWorkspaceAccess } from "../access/workspaceAccess.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";
import {
  buildAssetStorageKey,
  guessMimeFromFileName,
  newAssetId,
  readS3Config,
} from "../storage/assetKeys.js";
import { assetPublicUrl, objectExists, presignAssetPut, putAssetObject } from "../storage/s3.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

function assetDto(row: Asset) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fileName: row.fileName,
    mime: row.mime,
    byteSize: Number(row.byteSize),
    width: row.width,
    height: row.height,
    url: assetPublicUrl(row.storageKey),
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
  };
}

async function requireWorkspace(req: import("express").Request, res: import("express").Response, workspaceId: string, minRole: import("@prisma/client").WorkspaceRole = "guest") {
  const access = await requireWorkspaceAccess(req, res, workspaceId, minRole);
  if (!access) return null;
  return access.user;
}

export const assetsRouter = Router({ mergeParams: true });

assetsRouter.get("/", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!(await requireWorkspace(req, res, workspaceId))) return;
  const rows = await prisma.asset.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json(jsonV1Data(rows.map(assetDto)).body);
});

assetsRouter.post("/upload-url", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const user = await requireWorkspace(req, res, workspaceId, "member");
  if (!user) return;

  const body = req.body as Record<string, unknown>;
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "upload";
  const contentType =
    typeof body.contentType === "string" && body.contentType.trim()
      ? body.contentType.trim()
      : guessMimeFromFileName(fileName);

  const assetId = newAssetId();
  const storageKey = buildAssetStorageKey(workspaceId, assetId, fileName);
  const uploadUrl = await presignAssetPut(storageKey, contentType);

  res.status(200).json(
    jsonV1Data({
      assetId,
      storageKey,
      url: uploadUrl,
      method: "PUT",
      headers: { "Content-Type": contentType },
      publicUrl: assetPublicUrl(storageKey),
      fields: {},
    }).body,
  );
});

assetsRouter.post("/complete", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const user = await requireWorkspace(req, res, workspaceId, "member");
  if (!user) return;

  const body = req.body as Record<string, unknown>;
  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  const storageKey = typeof body.storageKey === "string" ? body.storageKey.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "upload";
  const mime =
    typeof body.mime === "string" && body.mime.trim()
      ? body.mime.trim()
      : guessMimeFromFileName(fileName);

  if (!assetId || !storageKey) {
    res.status(400).json(jsonV1Error("VALIDATION", "assetId and storageKey are required", 400).body);
    return;
  }
  if (!storageKey.startsWith(`workspaces/${workspaceId}/`)) {
    res.status(400).json(jsonV1Error("VALIDATION", "storageKey does not match workspace", 400).body);
    return;
  }

  const head = await objectExists(storageKey);
  if (!head) {
    res.status(400).json(jsonV1Error("VALIDATION", "Object not found in storage", 400).body);
    return;
  }

  const byteSize =
    typeof body.byteSize === "number" && body.byteSize > 0 ? Math.floor(body.byteSize) : head.byteSize;

  const row = await prisma.asset.create({
    data: {
      id: assetId,
      workspaceId,
      storageKey,
      fileName,
      mime,
      byteSize: BigInt(byteSize),
      width: typeof body.width === "number" ? Math.floor(body.width) : undefined,
      height: typeof body.height === "number" ? Math.floor(body.height) : undefined,
      createdByUserId: user.id,
    },
  });

  res.status(201).json(jsonV1Data(assetDto(row)).body);
});

/** Multipart upload — compatible with `apiClient.uploadAsset` in remote mode. */
assetsRouter.post("/", upload.single("file"), async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const user = await requireWorkspace(req, res, workspaceId, "member");
  if (!user) return;

  const file = req.file;
  if (!file || !file.buffer?.length) {
    res.status(400).json(jsonV1Error("VALIDATION", "Missing file", 400).body);
    return;
  }

  const fileName = file.originalname?.trim() || "upload";
  const mime = file.mimetype || guessMimeFromFileName(fileName);
  const assetId = newAssetId();
  const storageKey = buildAssetStorageKey(workspaceId, assetId, fileName);

  await putAssetObject(storageKey, file.buffer, mime);

  const row = await prisma.asset.create({
    data: {
      id: assetId,
      workspaceId,
      storageKey,
      fileName,
      mime,
      byteSize: BigInt(file.size),
      createdByUserId: user.id,
    },
  });

  res.status(201).json(
    jsonV1Data({
      assetId: row.id,
      url: assetPublicUrl(row.storageKey),
    }).body,
  );
});

assetsRouter.get("/health", (_req, res) => {
  const cfg = readS3Config();
  res.status(200).json(jsonV1Data({ ok: true, bucket: cfg.bucket, endpoint: cfg.endpoint }).body);
});

assetsRouter.get("/:assetId", async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!(await requireWorkspace(req, res, workspaceId))) return;
  const row = await prisma.asset.findFirst({
    where: { id: req.params.assetId, workspaceId },
  });
  if (!row) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "Asset not found", 404).body);
    return;
  }
  res.status(200).json(jsonV1Data(assetDto(row)).body);
});
