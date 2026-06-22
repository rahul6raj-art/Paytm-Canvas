import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { detectMcpProduct } from "@/lib/mcp/productBindings";
import type {
  McpCallToolResult,
  McpConnectionRequest,
  McpTestResult,
  McpToolContentBlock,
  McpToolSummary,
} from "@/lib/mcp/types";

export function isMcpStdioAllowed(): boolean {
  const raw = process.env.MCP_STDIO_ENABLED?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return process.env.NODE_ENV !== "production";
}

function validateConnectionConfig(config: McpConnectionRequest): string | null {
  if (!config.name?.trim()) return "Connection name is required.";
  if (config.transport === "http") {
    const url = config.url?.trim();
    if (!url) return "HTTP MCP URL is required.";
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "HTTP MCP URL must use http or https.";
      }
    } catch {
      return "HTTP MCP URL is invalid.";
    }
    return null;
  }
  if (config.transport === "stdio") {
    if (!isMcpStdioAllowed()) {
      return "Stdio MCP is disabled on this server. Set MCP_STDIO_ENABLED=1 or use HTTP transport.";
    }
    if (!config.command?.trim()) return "Stdio command is required.";
    return null;
  }
  return "Unknown transport type.";
}

async function withMcpClient<T>(
  config: McpConnectionRequest,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const validationError = validateConnectionConfig(config);
  if (validationError) throw new Error(validationError);

  const client = new Client({ name: "paytm-craft-canvas", version: "0.1.0" });
  let transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;

  try {
    if (config.transport === "http") {
      const headers = config.headers ?? {};
      transport = new StreamableHTTPClientTransport(new URL(config.url!.trim()), {
        requestInit: { headers },
      });
    } else {
      transport = new StdioClientTransport({
        command: config.command!.trim(),
        args: config.args ?? [],
        env: config.env,
        stderr: "pipe",
      });
    }

    await client.connect(transport);
    return await fn(client);
  } finally {
    try {
      await transport?.close?.();
    } catch {
      /* ignore */
    }
  }
}

function mapTools(tools: { name: string; title?: string; description?: string }[]): McpToolSummary[] {
  return tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
  }));
}

function mapToolContent(content: unknown[]): McpToolContentBlock[] {
  return content.map((item) => {
    if (!item || typeof item !== "object") return { type: "unknown", raw: item };
    const block = item as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      return { type: "text", text: block.text };
    }
    if (block.type === "image" && typeof block.data === "string") {
      return {
        type: "image",
        mimeType: typeof block.mimeType === "string" ? block.mimeType : "image/png",
        data: block.data,
      };
    }
    if (block.type === "resource") {
      const resource = block.resource as Record<string, unknown> | undefined;
      return {
        type: "resource",
        uri: typeof resource?.uri === "string" ? resource.uri : "",
        mimeType: typeof resource?.mimeType === "string" ? resource.mimeType : undefined,
        text: typeof resource?.text === "string" ? resource.text : undefined,
      };
    }
    return { type: "unknown", raw: item };
  });
}

export async function testMcpConnection(config: McpConnectionRequest): Promise<McpTestResult> {
  try {
    return await withMcpClient(config, async (client) => {
      const result = await client.request({ method: "tools/list", params: {} }, ListToolsResultSchema);
      const tools = mapTools(result.tools);
      const productId = detectMcpProduct(tools, config.productId);
      return {
        ok: true,
        serverName: client.getServerVersion()?.name,
        serverVersion: client.getServerVersion()?.version,
        tools,
        productId,
        message: `Connected — ${tools.length} tool${tools.length === 1 ? "" : "s"} available.`,
      };
    });
  } catch (e) {
    return {
      ok: false,
      tools: [],
      productId: config.productId ?? "custom",
      error: e instanceof Error ? e.message : "Connection failed.",
    };
  }
}

export async function callMcpTool(
  config: McpConnectionRequest,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<McpCallToolResult> {
  const name = toolName?.trim();
  if (!name) return { ok: false, content: [], error: "Tool name is required." };

  try {
    return await withMcpClient(config, async (client) => {
      const result = await client.request(
        {
          method: "tools/call",
          params: { name, arguments: args },
        },
        CallToolResultSchema,
      );
      return {
        ok: !result.isError,
        content: mapToolContent(result.content as unknown[]),
        isError: result.isError,
        error: result.isError ? "Tool returned an error." : undefined,
      };
    });
  } catch (e) {
    return {
      ok: false,
      content: [],
      error: e instanceof Error ? e.message : "Tool call failed.",
    };
  }
}

export { validateConnectionConfig };
