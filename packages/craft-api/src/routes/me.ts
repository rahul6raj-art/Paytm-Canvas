import { Router } from "express";
import multer from "multer";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";
import { resolveRequestUser, userDto } from "../middleware/auth.js";
import { guessMimeFromFileName } from "../storage/assetKeys.js";
import { assetPublicUrl, putAssetObject } from "../storage/s3.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const IMAGE_MIME = /^image\//;

function avatarStorageKey(userId: string, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".jpg";
  return `users/${userId}/avatar${ext.toLowerCase()}`;
}

async function requireAuthUser(req: import("express").Request, res: import("express").Response) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return null;
  }
  return user;
}

export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;
  res.status(200).json(jsonV1Data(userDto(user)).body);
});

meRouter.patch("/", async (req, res) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const body = req.body as Record<string, unknown>;
  const data: { displayName?: string; avatarUrl?: string | null } = {};

  if (typeof body.displayName === "string") {
    const displayName = body.displayName.trim();
    if (!displayName) {
      res.status(400).json(jsonV1Error("VALIDATION", "displayName cannot be empty", 400).body);
      return;
    }
    data.displayName = displayName;
  }

  if (body.removeAvatar === true) {
    data.avatarUrl = null;
  }

  if (!("displayName" in data) && !("avatarUrl" in data)) {
    res.status(400).json(jsonV1Error("VALIDATION", "No profile fields to update", 400).body);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });
  res.status(200).json(jsonV1Data(userDto(updated)).body);
});

meRouter.post("/avatar", upload.single("file"), async (req, res) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const file = req.file;
  if (!file || !file.buffer?.length) {
    res.status(400).json(jsonV1Error("VALIDATION", "Missing file", 400).body);
    return;
  }

  const mime = file.mimetype || guessMimeFromFileName(file.originalname ?? "avatar.jpg");
  if (!IMAGE_MIME.test(mime)) {
    res.status(400).json(jsonV1Error("VALIDATION", "Avatar must be an image", 400).body);
    return;
  }

  const fileName = file.originalname?.trim() || "avatar.jpg";
  const storageKey = avatarStorageKey(user.id, fileName);
  await putAssetObject(storageKey, file.buffer, mime);
  const avatarUrl = assetPublicUrl(storageKey);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });
  res.status(200).json(jsonV1Data(userDto(updated)).body);
});

meRouter.post("/password", async (req, res) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (!currentPassword || newPassword.length < 8) {
    res
      .status(400)
      .json(jsonV1Error("VALIDATION", "currentPassword and newPassword (8+ chars) required", 400).body);
    return;
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row?.passwordHash || !verifyPassword(currentPassword, row.passwordHash)) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Current password is incorrect", 401).body);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });
  res.status(200).json(jsonV1Data(userDto(updated)).body);
});
