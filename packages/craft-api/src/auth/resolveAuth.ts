import type { User } from "@prisma/client";
import type { ApiTokenScope } from "./apiTokenScope.js";
import type { ApiTokenResourceScope } from "./apiTokenResourceScope.js";
import { findApiTokenAuth } from "./apiToken.js";
import { findUserBySessionToken } from "./session.js";

export type JoinAuthResult = {
  user: User;
  scope: ApiTokenScope | "full";
  resourceScopes: ApiTokenResourceScope[];
};

/** Resolve a bearer or websocket session secret to a user (session cookie value or API token). */
export async function resolveUserByAuthToken(token: string): Promise<User | null> {
  const auth = await resolveJoinAuth(token);
  return auth?.user ?? null;
}

/** Auth for HTTP or websocket join — session tokens get full write access. */
export async function resolveJoinAuth(token: string): Promise<JoinAuthResult | null> {
  const sessionUser = await findUserBySessionToken(token);
  if (sessionUser) return { user: sessionUser, scope: "full", resourceScopes: [] };
  const apiAuth = await findApiTokenAuth(token);
  if (!apiAuth) return null;
  return {
    user: apiAuth.user,
    scope: apiAuth.scope,
    resourceScopes: apiAuth.resourceScopes,
  };
}
