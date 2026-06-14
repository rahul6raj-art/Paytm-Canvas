import type { CraftApiTokenCreated } from "@/lib/apiClient";

export type ApiTokenScope = "read" | "write";

export type ApiTokenResourceScope =
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

export const API_TOKEN_RESOURCE_SCOPE_OPTIONS: {
  value: ApiTokenResourceScope;
  label: string;
  group: string;
}[] = [
  { value: "files:read", label: "Read files", group: "Files" },
  { value: "files:write", label: "Write files", group: "Files" },
  { value: "assets:read", label: "Read assets", group: "Assets" },
  { value: "assets:write", label: "Write assets", group: "Assets" },
  { value: "comments:read", label: "Read comments", group: "Comments" },
  { value: "comments:write", label: "Write comments", group: "Comments" },
  { value: "teams:read", label: "Read teams", group: "Teams" },
  { value: "teams:write", label: "Manage teams", group: "Teams" },
  { value: "workspaces:read", label: "List workspaces", group: "Workspaces" },
  { value: "realtime:write", label: "Realtime document sync", group: "Realtime" },
];

export const API_TOKEN_SCOPE_OPTIONS: { value: ApiTokenScope; label: string; description: string }[] = [
  {
    value: "write",
    label: "Read & write",
    description: "Full API access and realtime document updates",
  },
  {
    value: "read",
    label: "Read-only",
    description: "GET requests and receive-only realtime sync",
  },
];

export const API_TOKEN_EXPIRY_PRESETS = [
  { label: "No expiry", days: null },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
] as const;

export function formatApiTokenScope(scope: ApiTokenScope): string {
  return API_TOKEN_SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? scope;
}

export function formatApiTokenResourceScope(scope: ApiTokenResourceScope): string {
  return API_TOKEN_RESOURCE_SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? scope;
}

export function formatApiTokenScopes(
  scope: ApiTokenScope,
  resourceScopes: ApiTokenResourceScope[] = [],
): string {
  if (resourceScopes.length === 0) return formatApiTokenScope(scope);
  if (resourceScopes.length <= 2) {
    return resourceScopes.map(formatApiTokenResourceScope).join(", ");
  }
  return `${resourceScopes.length} custom scopes`;
}

export function parseTokenExpiryDaysInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "none") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return undefined;
  if (n > 365) return undefined;
  return n;
}

export function formatApiTokenExpiry(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "No expiry";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "Unknown";
  if (at <= now) return "Expired";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

export function formatApiTokenLastUsed(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function apiTokenCreatedSuccessMessage(created: CraftApiTokenCreated): string {
  const expiry = formatApiTokenExpiry(created.expiresAt);
  const scope = formatApiTokenScopes(created.scope, created.resourceScopes);
  return [
    `Token "${created.name}" created.`,
    `Scope: ${scope}`,
    `Copy this secret now — it won't be shown again:`,
    created.token,
    `Expires: ${expiry}`,
    "Use as: Authorization: Bearer <token> or CRAFT_API_TOKEN for verify:stack:live",
  ].join("\n");
}
