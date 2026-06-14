import type { ApiTokenScope } from "./apiTokenScope.js";
import { httpMethodRequiresWrite } from "./apiTokenScope.js";

export const API_TOKEN_RESOURCE_SCOPES = [
  "files:read",
  "files:write",
  "assets:read",
  "assets:write",
  "comments:read",
  "comments:write",
  "teams:read",
  "teams:write",
  "workspaces:read",
  "realtime:write",
] as const;

export type ApiTokenResourceScope = (typeof API_TOKEN_RESOURCE_SCOPES)[number];

const RESOURCE_SCOPE_SET = new Set<string>(API_TOKEN_RESOURCE_SCOPES);

export function isApiTokenResourceScope(raw: string): raw is ApiTokenResourceScope {
  return RESOURCE_SCOPE_SET.has(raw);
}

export function parseApiTokenResourceScopes(raw: unknown): ApiTokenResourceScope[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: ApiTokenResourceScope[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isApiTokenResourceScope(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function resourceScopesFromLegacyScope(scope: ApiTokenScope): ApiTokenResourceScope[] {
  if (scope === "write") return [...API_TOKEN_RESOURCE_SCOPES];
  return API_TOKEN_RESOURCE_SCOPES.filter((s) => !s.endsWith(":write"));
}

export function effectiveResourceScopes(
  scope: ApiTokenScope,
  resourceScopes: ApiTokenResourceScope[],
): Set<ApiTokenResourceScope> {
  const list = resourceScopes.length > 0 ? resourceScopes : resourceScopesFromLegacyScope(scope);
  return new Set(list);
}

export function apiTokenResourceScopeLabel(scope: ApiTokenResourceScope): string {
  const [resource, action] = scope.split(":");
  const resourceLabel =
    resource === "files"
      ? "Files"
      : resource === "assets"
        ? "Assets"
        : resource === "comments"
          ? "Comments"
          : resource === "teams"
            ? "Teams"
            : resource === "workspaces"
              ? "Workspaces"
              : resource === "realtime"
                ? "Realtime"
                : resource;
  const actionLabel = action === "read" ? "read" : "write";
  return `${resourceLabel} (${actionLabel})`;
}

export function formatResourceScopesSummary(
  scope: ApiTokenScope,
  resourceScopes: ApiTokenResourceScope[],
): string {
  if (resourceScopes.length === 0) {
    return scope === "read" ? "Read-only (all resources)" : "Read & write (all resources)";
  }
  if (resourceScopes.length <= 3) {
    return resourceScopes.map(apiTokenResourceScopeLabel).join(", ");
  }
  return `${resourceScopes.length} custom scopes`;
}

type HttpScopeRule = { test: RegExp; read: ApiTokenResourceScope; write: ApiTokenResourceScope };

const HTTP_SCOPE_RULES: HttpScopeRule[] = [
  { test: /^\/files(?:\/|$)/, read: "files:read", write: "files:write" },
  { test: /^\/comments(?:\/|$)/, read: "comments:read", write: "comments:write" },
  { test: /^\/teams(?:\/|$)/, read: "teams:read", write: "teams:write" },
  {
    test: /^\/workspaces\/[^/]+\/assets(?:\/|$)/,
    read: "assets:read",
    write: "assets:write",
  },
  {
    test: /^\/workspaces\/[^/]+\/members(?:\/|$)/,
    read: "teams:read",
    write: "teams:write",
  },
  {
    test: /^\/workspaces\/[^/]+\/invites(?:\/|$)/,
    read: "teams:read",
    write: "teams:write",
  },
  { test: /^\/workspaces(?:\/|$)/, read: "workspaces:read", write: "workspaces:write" },
];

export function resolveHttpResourceScope(method: string, path: string): ApiTokenResourceScope | null {
  const normalized = path.split("?")[0] ?? path;
  for (const rule of HTTP_SCOPE_RULES) {
    if (!rule.test.test(normalized)) continue;
    return httpMethodRequiresWrite(method) ? rule.write : rule.read;
  }
  return null;
}

export function apiTokenAllowsHttpRequest(
  scope: ApiTokenScope,
  resourceScopes: ApiTokenResourceScope[],
  method: string,
  path: string,
): boolean {
  const required = resolveHttpResourceScope(method, path);
  if (!required) return true;
  return effectiveResourceScopes(scope, resourceScopes).has(required);
}

export function apiTokenAllowsRealtimeWrite(
  scope: ApiTokenScope,
  resourceScopes: ApiTokenResourceScope[] = [],
): boolean {
  return effectiveResourceScopes(scope, resourceScopes).has("realtime:write");
}
