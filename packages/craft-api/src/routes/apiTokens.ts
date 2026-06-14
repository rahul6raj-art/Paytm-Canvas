import { Router } from "express";
import { createApiToken, listApiTokensForUser, revokeApiToken } from "../auth/apiToken.js";
import { parseExpiresInDays } from "../auth/apiTokenExpiry.js";
import { parseApiTokenScope } from "../auth/apiTokenScope.js";
import { parseApiTokenResourceScopes } from "../auth/apiTokenResourceScope.js";
import { findUserBySessionToken, parseCookies, SESSION_COOKIE } from "../auth/session.js";
import { jsonV1Data, jsonV1Error } from "../envelope.js";

export const apiTokensRouter = Router();

async function requireCookieSession(req: import("express").Request, res: import("express").Response) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Sign in with a session cookie to manage API tokens", 401).body);
    return null;
  }
  const user = await findUserBySessionToken(token);
  if (!user) {
    res.status(401).json(jsonV1Error("UNAUTHORIZED", "Session expired — sign in again", 401).body);
    return null;
  }
  return user;
}

apiTokensRouter.get("/", async (req, res) => {
  const user = await requireCookieSession(req, res);
  if (!user) return;
  const rows = await listApiTokensForUser(user.id);
  res.status(200).json(jsonV1Data(rows).body);
});

apiTokensRouter.post("/", async (req, res) => {
  const user = await requireCookieSession(req, res);
  if (!user) return;
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json(jsonV1Error("VALIDATION", "name is required", 400).body);
    return;
  }
  const expiresInDays = parseExpiresInDays(req.body?.expiresInDays);
  if (req.body?.expiresInDays != null && req.body?.expiresInDays !== "" && expiresInDays == null) {
    res.status(400).json(jsonV1Error("VALIDATION", "expiresInDays must be a positive integer up to 365", 400).body);
    return;
  }
  const scope = parseApiTokenScope(req.body?.scope) ?? "write";
  if (req.body?.scope != null && req.body?.scope !== "" && parseApiTokenScope(req.body?.scope) == null) {
    res.status(400).json(jsonV1Error("VALIDATION", 'scope must be "read" or "write"', 400).body);
    return;
  }
  const resourceScopes = parseApiTokenResourceScopes(req.body?.resourceScopes);
  if (req.body?.resourceScopes != null && resourceScopes == null) {
    res
      .status(400)
      .json(
        jsonV1Error(
          "VALIDATION",
          'resourceScopes must be an array of scopes like "files:read" or "assets:write"',
          400,
        ).body,
      );
    return;
  }
  try {
    const created = await createApiToken(user.id, name, expiresInDays, scope, resourceScopes ?? []);
    res.status(201).json(
      jsonV1Data({
        ...created.row,
        token: created.token,
      }).body,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create token";
    res.status(400).json(jsonV1Error("VALIDATION", message, 400).body);
  }
});

apiTokensRouter.delete("/:tokenId", async (req, res) => {
  const user = await requireCookieSession(req, res);
  if (!user) return;
  const tokenId = String(req.params.tokenId ?? "").trim();
  if (!tokenId) {
    res.status(400).json(jsonV1Error("VALIDATION", "tokenId required", 400).body);
    return;
  }
  const revoked = await revokeApiToken(user.id, tokenId);
  if (!revoked) {
    res.status(404).json(jsonV1Error("NOT_FOUND", "Token not found", 404).body);
    return;
  }
  res.status(200).json(jsonV1Data({ ok: true }).body);
});
