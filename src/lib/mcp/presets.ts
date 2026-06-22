import type { McpConnectionConfig, McpProductDef, McpProductId } from "@/lib/mcp/types";

export const MCP_PRODUCTS: McpProductDef[] = [
  {
    id: "figma",
    label: "Figma",
    description: "Design files, frames, and components",
    toolHints: ["figma", "get_design", "design_context", "screenshot"],
    canvasActions: ["open-figma-import", "run-tool"],
  },
  {
    id: "github",
    label: "GitHub",
    description: "Repos, issues, and pull requests",
    toolHints: ["github", "repo", "pull_request", "issue"],
    canvasActions: ["open-code-bridge", "run-tool"],
  },
  {
    id: "linear",
    label: "Linear",
    description: "Issues and project tracking",
    toolHints: ["linear", "issue"],
    canvasActions: ["run-tool"],
  },
  {
    id: "notion",
    label: "Notion",
    description: "Docs and databases",
    toolHints: ["notion", "page", "database"],
    canvasActions: ["run-tool"],
  },
  {
    id: "slack",
    label: "Slack",
    description: "Channels and messages",
    toolHints: ["slack", "channel", "message"],
    canvasActions: ["run-tool"],
  },
  {
    id: "shadcn",
    label: "shadcn/ui",
    description: "Component registry and docs",
    toolHints: ["shadcn", "component", "registry"],
    canvasActions: ["open-code-bridge", "run-tool"],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Any MCP-compatible server",
    toolHints: [],
    canvasActions: ["run-tool"],
  },
];

export type McpPresetTemplate = {
  id: string;
  label: string;
  productId: McpProductId;
  transport: McpConnectionConfig["transport"];
  description: string;
  defaults: Partial<McpConnectionConfig>;
};

export const MCP_PRESET_TEMPLATES: McpPresetTemplate[] = [
  {
    id: "custom-http",
    label: "Custom HTTP MCP",
    productId: "custom",
    transport: "http",
    description: "Remote MCP over Streamable HTTP (works on production).",
    defaults: {
      name: "Custom HTTP",
      url: "https://example.com/mcp",
      headers: {},
    },
  },
  {
    id: "github-stdio",
    label: "GitHub (stdio)",
    productId: "github",
    transport: "stdio",
    description: "Official GitHub MCP via npx (local Craft / self-hosted only).",
    defaults: {
      name: "GitHub",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    },
  },
  {
    id: "shadcn-stdio",
    label: "shadcn/ui (stdio)",
    productId: "shadcn",
    transport: "stdio",
    description: "shadcn component registry MCP (local Craft / self-hosted only).",
    defaults: {
      name: "shadcn",
      command: "npx",
      args: ["shadcn@latest", "mcp"],
    },
  },
  {
    id: "figma-note",
    label: "Figma",
    productId: "figma",
    transport: "http",
    description:
      "Figma’s official MCP uses OAuth in Cursor. Use Craft’s built-in Figma import, or point HTTP at your own Figma MCP proxy.",
    defaults: {
      name: "Figma",
      url: "",
    },
  },
];

export function productDef(id: McpProductId): McpProductDef {
  return MCP_PRODUCTS.find((p) => p.id === id) ?? MCP_PRODUCTS[MCP_PRODUCTS.length - 1]!;
}
