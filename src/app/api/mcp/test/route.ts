import { NextResponse } from "next/server";
import { testMcpConnection, validateConnectionConfig } from "@/integrations/mcp/mcpSession";
import type { McpConnectionRequest } from "@/lib/mcp/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { connection?: McpConnectionRequest };

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
    const result = await testMcpConnection(connection);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("[mcp/test]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "MCP test failed." },
      { status: 500 },
    );
  }
}
