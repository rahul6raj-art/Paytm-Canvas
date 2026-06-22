import type { McpConnectionConfig } from "@/lib/mcp/types";

const STORAGE_KEY = "paytm-craft-mcp-connections-v1";

export function readMcpConnections(): McpConnectionConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as McpConnectionConfig[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c) => c?.id && c?.name);
  } catch {
    return [];
  }
}

export function writeMcpConnections(connections: McpConnectionConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  } catch {
    /* ignore quota */
  }
}

export function upsertMcpConnection(connection: McpConnectionConfig): McpConnectionConfig[] {
  const list = readMcpConnections();
  const idx = list.findIndex((c) => c.id === connection.id);
  const next = [...list];
  if (idx >= 0) next[idx] = connection;
  else next.push(connection);
  writeMcpConnections(next);
  return next;
}

export function removeMcpConnection(id: string): McpConnectionConfig[] {
  const next = readMcpConnections().filter((c) => c.id !== id);
  writeMcpConnections(next);
  return next;
}

export function newMcpConnectionId(): string {
  return `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Strip secrets before logging or displaying in non-secret fields. */
export function redactMcpConnection(c: McpConnectionConfig): McpConnectionConfig {
  const env = c.env
    ? Object.fromEntries(Object.entries(c.env).map(([k, v]) => [k, v ? "••••••" : ""]))
    : undefined;
  const headers = c.headers
    ? Object.fromEntries(Object.entries(c.headers).map(([k, v]) => [k, v ? "••••••" : ""]))
    : undefined;
  return { ...c, env, headers };
}
