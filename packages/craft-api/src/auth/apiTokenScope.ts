export type ApiTokenScope = "read" | "write";

export const API_TOKEN_SCOPES: ApiTokenScope[] = ["read", "write"];

export function parseApiTokenScope(raw: unknown): ApiTokenScope | null {
  if (raw === "read" || raw === "write") return raw;
  return null;
}

export function apiTokenScopeLabel(scope: ApiTokenScope): string {
  return scope === "read" ? "Read-only" : "Read & write";
}

export function apiTokenScopeDescription(scope: ApiTokenScope): string {
  return scope === "read"
    ? "GET requests and receive-only realtime sync"
    : "Full API and realtime document updates";
}

export function httpMethodRequiresWrite(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

export function apiTokenAllowsHttpMethod(scope: ApiTokenScope, method: string): boolean {
  if (scope === "write") return true;
  return !httpMethodRequiresWrite(method);
}

export { apiTokenAllowsRealtimeWrite } from "./apiTokenResourceScope.js";
