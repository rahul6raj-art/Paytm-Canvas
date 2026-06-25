import { Router } from "express";
import { prisma } from "../db.js";
import { acceptPendingInvitesForUser } from "../access/acceptWorkspaceInvites.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { requestPasswordReset, resetPasswordWithToken } from "../auth/passwordReset.js";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  parseCookies,
  revokeSessionToken,
  SESSION_COOKIE,
} from "../auth/session.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";
import { resolveRequestUser, userDto } from "../middleware/auth.js";
import { apiTokensRouter } from "./apiTokens.js";
import { oauthRouter } from "./oauth.js";

export const authRouter = Router();

authRouter.use("/tokens", apiTokensRouter);
authRouter.use("/oauth", oauthRouter);

authRouter.get("/me", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Not signed in", 401).body);
    return;
  }
  res.status(200).json(jsonV1Data(userDto(user)).body);
});

authRouter.post("/register", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const displayName = String(req.body?.displayName ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!email || !displayName || password.length < 8) {
    res
      .status(400)
      .json(jsonV1Error("VALIDATION", "email, displayName, and password (8+ chars) required", 400).body);
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json(jsonV1Error("CONFLICT", "Email already registered", 409).body);
    return;
  }

  const id = `user-${email.split("@")[0]}-${Date.now().toString(36)}`;
  const user = await prisma.user.create({
    data: {
      id,
      email,
      displayName,
      passwordHash: hashPassword(password),
    },
  });

  await acceptPendingInvitesForUser(prisma, user.id, email);

  const token = await createSession(user.id);
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  res.status(201).json(jsonV1Data(userDto(user)).body);
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    res.status(400).json(jsonV1Error("VALIDATION", "email and password required", 400).body);
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Invalid email or password", 401).body);
    return;
  }

  const token = await createSession(user.id);
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  res.status(200).json(jsonV1Data(userDto(user)).body);
});

authRouter.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  if (!email) {
    res.status(400).json(jsonV1Error("VALIDATION", "email required", 400).body);
    return;
  }

  try {
    const result = await requestPasswordReset(email);
    res.status(200).json(jsonV1Data(result).body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not request password reset";
    res.status(400).json(jsonV1Error("VALIDATION", message, 400).body);
  }
});

authRouter.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  const newPassword = String(req.body?.newPassword ?? "");
  if (!token || newPassword.length < 8) {
    res
      .status(400)
      .json(jsonV1Error("VALIDATION", "token and newPassword (8+ chars) required", 400).body);
    return;
  }

  try {
    const user = await resetPasswordWithToken(token, newPassword);
    res.status(200).json(jsonV1Data(userDto(user)).body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not reset password";
    res.status(400).json(jsonV1Error("VALIDATION", message, 400).body);
  }
});

authRouter.post("/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) await revokeSessionToken(token);
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(200).json(jsonV1Data({ ok: true }).body);
});
