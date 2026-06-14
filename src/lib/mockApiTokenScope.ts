export type MockApiTokenScope = "read" | "write";

export type MockApiTokenResourceScope =
  | "files:read"
  | "files:write"
  | "assets:read"
  | "assets:write"
  | "comments:read"
  | "comments:write"
  | "teams:read"
  | "teams:write"
  | "workspaces:read"
  | "realtime:write";

export const MOCK_API_TOKEN_RESOURCE_SCOPES: MockApiTokenResourceScope[] = [
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
];

const RESOURCE_SCOPE_SET = new Set<string>(MOCK_API_TOKEN_RESOURCE_SCOPES);

export function parseMockApiTokenResourceScopes(raw: unknown): MockApiTokenResourceScope[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: MockApiTokenResourceScope[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !RESOURCE_SCOPE_SET.has(item)) return null;
    if (!out.includes(item as MockApiTokenResourceScope)) out.push(item as MockApiTokenResourceScope);
  }
  return out;
}

export function parseMockApiTokenScope(raw: unknown): MockApiTokenScope | null {
  if (raw === "read" || raw === "write") return raw;
  return null;
}

export function httpMethodRequiresWrite(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

export function resourceScopesFromLegacyScope(scope: MockApiTokenScope): MockApiTokenResourceScope[] {
  if (scope === "write") return [...MOCK_API_TOKEN_RESOURCE_SCOPES];
  return MOCK_API_TOKEN_RESOURCE_SCOPES.filter((s) => !s.endsWith(":write"));
}

export function effectiveResourceScopes(
  scope: MockApiTokenScope,
  resourceScopes: MockApiTokenResourceScope[],
): Set<MockApiTokenResourceScope> {
  const list = resourceScopes.length > 0 ? resourceScopes : resourceScopesFromLegacyScope(scope);
  return new Set(list);
}

export function mockApiTokenAllowsHttp(
  scope: MockApiTokenScope,
  resourceScopes: MockApiTokenResourceScope[],
  required: MockApiTokenResourceScope,
): boolean {
  return effectiveResourceScopes(scope, resourceScopes).has(required);
}

export function mockApiTokenAllowsRealtimeWrite(
  scope: MockApiTokenScope,
  resourceScopes: MockApiTokenResourceScope[] = [],
): boolean {
  return effectiveResourceScopes(scope, resourceScopes).has("realtime:write");
}
