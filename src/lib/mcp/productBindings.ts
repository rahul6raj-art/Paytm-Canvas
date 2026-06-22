import { MCP_PRODUCTS } from "@/lib/mcp/presets";
import type { McpCanvasActionId, McpProductId, McpToolSummary } from "@/lib/mcp/types";

export function detectMcpProduct(
  tools: McpToolSummary[],
  declaredProductId?: McpProductId,
): McpProductId {
  if (declaredProductId && declaredProductId !== "custom") return declaredProductId;

  const haystack = tools
    .flatMap((t) => [t.name, t.title ?? "", t.description ?? ""])
    .join(" ")
    .toLowerCase();

  for (const product of MCP_PRODUCTS) {
    if (product.id === "custom") continue;
    if (product.toolHints.some((hint) => haystack.includes(hint))) {
      return product.id;
    }
  }
  return declaredProductId ?? "custom";
}

export function canvasActionLabel(action: McpCanvasActionId): string {
  switch (action) {
    case "open-figma-import":
      return "Import from Figma";
    case "open-code-bridge":
      return "Design ↔ Code bridge";
    case "open-import-hub":
      return "Import hub";
    case "run-tool":
      return "Run MCP tool";
    default:
      return action;
  }
}

export function canvasActionDescription(action: McpCanvasActionId, productId: McpProductId): string {
  switch (action) {
    case "open-figma-import":
      return "Open Craft’s Figma importer to pull frames onto the canvas.";
    case "open-code-bridge":
      return "Link source files and sync React/HTML with the canvas.";
    case "open-import-hub":
      return "Import from Figma, web capture, or code.";
    case "run-tool":
      return `Call a tool exposed by your ${productId} MCP server.`;
    default:
      return "";
  }
}
