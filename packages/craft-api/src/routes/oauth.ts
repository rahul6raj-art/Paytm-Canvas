import { Router } from "express";
import {
  buildGithubAuthUrl,
  buildGoogleAuthUrl,
  craftAppUrl,
  createOAuthState,
  exchangeGithubCode,
  exchangeGoogleCode,
  githubOAuthDevMockProfile,
  googleOAuthDevMockProfile,
  isGithubOAuthDevMockEnabled,
  isGoogleOAuthDevMockEnabled,
  parseOAuthProvider,
  readGithubOAuthConfig,
  readGoogleOAuthConfig,
  readOAuthProvidersStatus,
  sanitizeOAuthNextPath,
  verifyOAuthState,
} from "@paytm-craft/oauth";
import { prisma } from "../db.js";
import { findOrCreateUserFromOAuth } from "../auth/findOrCreateUserFromOAuth.js";
import { buildSessionCookie, createSession } from "../auth/session.js";
import { jsonV1Data } from "../envelope.js";

export const oauthRouter = Router();

oauthRouter.get("/providers", (_req, res) => {
  res.status(200).json(jsonV1Data(readOAuthProvidersStatus()).body);
});

oauthRouter.get("/google/mock", async (req, res) => {
  if (!isGoogleOAuthDevMockEnabled()) {
    res.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
    return;
  }

  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const verified = verifyOAuthState(stateRaw);
  if (!verified || verified.provider !== "google") {
    res.redirect(`${craftAppUrl()}/login?error=oauth_invalid_state`);
    return;
  }

  try {
    const user = await findOrCreateUserFromOAuth(prisma, googleOAuthDevMockProfile());
    const token = await createSession(user.id);
    res.setHeader("Set-Cookie", buildSessionCookie(token));
    res.redirect(`${craftAppUrl()}${verified.next}`);
  } catch (e) {
    console.error("[craft-api] Google dev mock failed", e);
    res.redirect(`${craftAppUrl()}/login?error=oauth_failed`);
  }
});

oauthRouter.get("/github/mock", async (req, res) => {
  if (!isGithubOAuthDevMockEnabled()) {
    res.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
    return;
  }

  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const verified = verifyOAuthState(stateRaw);
  if (!verified || verified.provider !== "github") {
    res.redirect(`${craftAppUrl()}/login?error=oauth_invalid_state`);
    return;
  }

  try {
    const user = await findOrCreateUserFromOAuth(prisma, githubOAuthDevMockProfile());
    const token = await createSession(user.id);
    res.setHeader("Set-Cookie", buildSessionCookie(token));
    res.redirect(`${craftAppUrl()}${verified.next}`);
  } catch (e) {
    console.error("[craft-api] GitHub dev mock failed", e);
    res.redirect(`${craftAppUrl()}/login?error=oauth_failed`);
  }
});

oauthRouter.get("/:provider", (req, res) => {
  const provider = parseOAuthProvider(String(req.params.provider ?? ""));
  if (!provider) {
    res.redirect(`${craftAppUrl()}/login?error=oauth_invalid_provider`);
    return;
  }

  const next = sanitizeOAuthNextPath(typeof req.query.next === "string" ? req.query.next : "/");
  const state = createOAuthState(provider, next);

  if (provider === "google") {
    const config = readGoogleOAuthConfig("remote");
    if (config) {
      res.redirect(
        buildGoogleAuthUrl({
          clientId: config.clientId,
          redirectUri: config.redirectUri,
          state,
        }),
      );
      return;
    }
    if (isGoogleOAuthDevMockEnabled()) {
      res.redirect(`/v1/auth/oauth/google/mock?state=${encodeURIComponent(state)}`);
      return;
    }
    res.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
    return;
  }

  const config = readGithubOAuthConfig("remote");
  if (config) {
    res.redirect(
      buildGithubAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state,
      }),
    );
    return;
  }
  if (isGithubOAuthDevMockEnabled()) {
    res.redirect(`/v1/auth/oauth/github/mock?state=${encodeURIComponent(state)}`);
    return;
  }
  res.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
});

oauthRouter.get("/:provider/callback", async (req, res) => {
  const providerParam = parseOAuthProvider(String(req.params.provider ?? ""));
  const error = typeof req.query.error === "string" ? req.query.error : null;
  if (error) {
    res.redirect(`${craftAppUrl()}/login?error=oauth_denied`);
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const verified = verifyOAuthState(stateRaw);
  if (!providerParam || !verified || verified.provider !== providerParam || !code) {
    res.redirect(`${craftAppUrl()}/login?error=oauth_invalid_state`);
    return;
  }

  try {
    let profile;
    if (providerParam === "google") {
      const config = readGoogleOAuthConfig("remote");
      if (!config) throw new Error("Google OAuth is not configured");
      profile = await exchangeGoogleCode({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
    } else {
      const config = readGithubOAuthConfig("remote");
      if (!config) throw new Error("GitHub OAuth is not configured");
      profile = await exchangeGithubCode({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
    }

    const user = await findOrCreateUserFromOAuth(prisma, profile);
    const token = await createSession(user.id);
    res.setHeader("Set-Cookie", buildSessionCookie(token));
    res.redirect(`${craftAppUrl()}${verified.next}`);
  } catch (e) {
    console.error("[craft-api] OAuth callback failed", e);
    res.redirect(`${craftAppUrl()}/login?error=oauth_failed`);
  }
});
