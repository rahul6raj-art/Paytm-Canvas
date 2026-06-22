import type { McpConnectionRequest, McpTestResult } from "@/lib/mcp/types";

export async function testMcpConnectionApi(
  connection: McpConnectionRequest,
): Promise<McpTestResult> {
  const res = await fetch("/api/mcp/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection }),
  });
  const data = (await res.json()) as McpTestResult & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      tools: [],
      productId: connection.productId ?? "custom",
      error: data.error ?? `Request failed (${res.status}).`,
    };
  }
  return data;
}

export async function callMcpToolApi(
  connection: McpConnectionRequest,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const res = await fetch("/api/mcp/call-tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection, toolName, args }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false as const, content: [], error: data.error ?? `Request failed (${res.status}).` };
  }
  return data as import("@/lib/mcp/types").McpCallToolResult;
}

export async function fetchMcpCapabilities(): Promise<{
  stdioAllowed: boolean;
  authRequired: boolean;
}> {
  const res = await fetch("/api/mcp/capabilities");
  if (!res.ok) return { stdioAllowed: false, authRequired: false };
  return (await res.json()) as { stdioAllowed: boolean; authRequired: boolean };
}
