/** MCP connection configured in the canvas Integrations panel. */

export type McpTransportKind = "http" | "stdio";

export type McpConnectionConfig = {
  id: string;
  name: string;
  productId: McpProductId;
  transport: McpTransportKind;
  /** HTTP/SSE MCP endpoint (Streamable HTTP). */
  url?: string;
  headers?: Record<string, string>;
  /** Stdio server launch (local / self-hosted Craft only). */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  /** Set after a successful test. */
  lastConnectedAt?: string;
  /** Tool names discovered on last test. */
  toolNames?: string[];
  /** Human-readable status from last test. */
  lastStatus?: string;
};

export type McpProductId =
  | "figma"
  | "github"
  | "linear"
  | "notion"
  | "slack"
  | "shadcn"
  | "custom";

export type McpProductDef = {
  id: McpProductId;
  label: string;
  description: string;
  /** Substrings matched against listed tool names (lowercase). */
  toolHints: string[];
  /** Canvas quick action ids when this product is detected. */
  canvasActions: McpCanvasActionId[];
};

export type McpCanvasActionId =
  | "open-figma-import"
  | "open-code-bridge"
  | "open-import-hub"
  | "run-tool";

export type McpToolSummary = {
  name: string;
  title?: string;
  description?: string;
};

export type McpTestResult = {
  ok: boolean;
  serverName?: string;
  serverVersion?: string;
  tools: McpToolSummary[];
  productId: McpProductId;
  message?: string;
  error?: string;
};

export type McpCallToolResult = {
  ok: boolean;
  content: McpToolContentBlock[];
  isError?: boolean;
  error?: string;
};

export type McpToolContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string }
  | { type: "resource"; uri: string; mimeType?: string; text?: string }
  | { type: "unknown"; raw: unknown };

/** Payload sent from browser to Craft MCP proxy routes (includes secrets). */
export type McpConnectionRequest = Omit<
  McpConnectionConfig,
  "lastConnectedAt" | "toolNames" | "lastStatus"
>;
