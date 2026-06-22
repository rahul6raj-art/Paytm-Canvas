import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateConnectionConfig, isMcpStdioAllowed } from "@/integrations/mcp/mcpSession";
import type { McpConnectionRequest } from "@/lib/mcp/types";

describe("validateConnectionConfig", () => {
  it("requires http url", () => {
    const config: McpConnectionRequest = {
      id: "1",
      name: "Test",
      productId: "custom",
      transport: "http",
      enabled: true,
    };
    assert.equal(validateConnectionConfig(config), "HTTP MCP URL is required.");
  });

  it("accepts valid http config", () => {
    const config: McpConnectionRequest = {
      id: "1",
      name: "Test",
      productId: "custom",
      transport: "http",
      url: "https://example.com/mcp",
      enabled: true,
    };
    assert.equal(validateConnectionConfig(config), null);
  });

  it("blocks stdio in production by default", () => {
    const prev = process.env.NODE_ENV;
    const prevStdio = process.env.MCP_STDIO_ENABLED;
    process.env.NODE_ENV = "production";
    delete process.env.MCP_STDIO_ENABLED;
    assert.equal(isMcpStdioAllowed(), false);
    const config: McpConnectionRequest = {
      id: "1",
      name: "GH",
      productId: "github",
      transport: "stdio",
      command: "npx",
      enabled: true,
    };
    assert.match(validateConnectionConfig(config)!, /Stdio MCP is disabled/);
    process.env.NODE_ENV = prev;
    if (prevStdio === undefined) delete process.env.MCP_STDIO_ENABLED;
    else process.env.MCP_STDIO_ENABLED = prevStdio;
  });
});
