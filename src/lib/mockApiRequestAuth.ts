import { parseBearerToken } from "@/lib/apiTokenAuth";
import { jsonV1Error } from "@/lib/apiV1Responses";
import { findMockApiTokenBySecret, type MockApiTokenRow } from "@/lib/mockApiToken";
import {
  httpMethodRequiresWrite,
  mockApiTokenAllowsHttp,
  type MockApiTokenResourceScope,
  type MockApiTokenScope,
} from "@/lib/mockApiTokenScope";
import { mockApiStore, type MockApiUserRow } from "@/lib/mockApiStore";

export type MockApiRequestAuth =
  | { kind: "session"; user: MockApiUserRow }
  | {
      kind: "api_token";
      user: MockApiUserRow;
      scope: MockApiTokenScope;
      resourceScopes: MockApiTokenResourceScope[];
      tokenRow: MockApiTokenRow;
    };

export function resolveMockApiRequestAuth(request: Request): MockApiRequestAuth {
  const bearer = parseBearerToken(request.headers.get("authorization") ?? undefined);
  if (bearer) {
    const row = mockApiStore.findApiTokenBySecret(bearer);
    if (row) {
      const user = mockApiStore.getUserById(row.userId);
      if (user) {
        mockApiStore.touchApiToken(row.id);
        return {
          kind: "api_token",
          user,
          scope: row.scope,
          resourceScopes: row.resourceScopes,
          tokenRow: row,
        };
      }
    }
  }
  return { kind: "session", user: mockApiStore.getCurrentUser() };
}

export function mockApiTokenGuard(
  request: Request,
  method: string,
  scopes: { read: MockApiTokenResourceScope; write: MockApiTokenResourceScope },
): Response | null {
  const auth = resolveMockApiRequestAuth(request);
  if (auth.kind !== "api_token") return null;
  const required = httpMethodRequiresWrite(method) ? scopes.write : scopes.read;
  if (!mockApiTokenAllowsHttp(auth.scope, auth.resourceScopes, required)) {
    return jsonV1Error("FORBIDDEN", "API token lacks permission for this resource", 403);
  }
  return null;
}

export { findMockApiTokenBySecret };
