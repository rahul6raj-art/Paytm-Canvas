import type { User } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { isAnonAccessAllowed } from "../config.js";
import { findApiTokenAuth, parseBearerToken } from "../auth/apiToken.js";
import { apiTokenAllowsHttpRequest } from "../auth/apiTokenResourceScope.js";
import type { ApiTokenResourceScope } from "../auth/apiTokenResourceScope.js";
import type { ApiTokenScope } from "../auth/apiTokenScope.js";
import { findUserBySessionToken, parseCookies, SESSION_COOKIE } from "../auth/session.js";
import { jsonV1Error } from "../envelope.js";

export type CraftAuthKind = "session" | "api_token" | "anon";

declare global {
  namespace Express {
    interface Request {
      craftUser?: User;
      craftAuthKind?: CraftAuthKind;
      craftApiTokenScope?: ApiTokenScope;
      craftApiTokenResourceScopes?: ApiTokenResourceScope[];
    }
  }
}

export async function attachSessionUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE];
    if (cookieToken) {
      const user = await findUserBySessionToken(cookieToken);
      if (user) {
        req.craftUser = user;
        req.craftAuthKind = "session";
      }
    }
    if (!req.craftUser) {
      const bearer = parseBearerToken(req.headers.authorization);
      if (bearer) {
        const sessionUser = await findUserBySessionToken(bearer);
        if (sessionUser) {
          req.craftUser = sessionUser;
          req.craftAuthKind = "session";
        } else {
          const apiAuth = await findApiTokenAuth(bearer);
          if (apiAuth) {
            req.craftUser = apiAuth.user;
            req.craftAuthKind = "api_token";
            req.craftApiTokenScope = apiAuth.scope;
            req.craftApiTokenResourceScopes = apiAuth.resourceScopes;
          }
        }
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function enforceApiTokenScope(req: Request, res: Response, next: NextFunction) {
  if (req.craftAuthKind !== "api_token" || !req.craftApiTokenScope) return next();
  const path = req.path.replace(/^\/v1/, "") || "/";
  if (
    apiTokenAllowsHttpRequest(
      req.craftApiTokenScope,
      req.craftApiTokenResourceScopes ?? [],
      req.method,
      path,
    )
  ) {
    return next();
  }
  res.status(403).json(jsonV1Error("FORBIDDEN", "API token lacks permission for this resource", 403).body);
}

/** Authenticated user, or seeded dev user when anon access is allowed. */
export async function resolveRequestUser(req: Request): Promise<User | null> {
  if (req.craftUser) return req.craftUser;
  if (!isAnonAccessAllowed()) return null;
  req.craftAuthKind = "anon";
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}

export function userDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}
