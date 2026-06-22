import { NextResponse } from "next/server";
import { isMcpStdioAllowed } from "@/integrations/mcp/mcpSession";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    stdioAllowed: isMcpStdioAllowed(),
    /** Reserved for future team-level MCP auth. */
    authRequired: false,
  });
}
