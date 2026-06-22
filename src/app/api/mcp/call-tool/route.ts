import { NextResponse } from "next/server";
import { callMcpTool, validateConnectionConfig } from "@/integrations/mcp/mcpSession";
import type { McpConnectionRequest } from "@/lib/mcp/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  connection?: McpConnectionRequest;
  toolName?: string;
  args?: Record<string, unknown>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const connection = body.connection;
    if (!connection) {
      return NextResponse.json({ error: "connection is required." }, { status: 400 });
    }
    const validationError = validateConnectionConfig(connection);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const result = await callMcpTool(connection, body.toolName ?? "", body.args ?? {});
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("[mcp/call-tool]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "MCP tool call failed." },
      { status: 500 },
    );
  }
}
