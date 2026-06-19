import {
  exportPageCssFiles,
  filterBridgeSafeCssDeclarations,
} from "@/lib/codeRoundTrip/exportPageCss";
import { collectIconColorSelectorUpdates } from "@/lib/craftBridge/exportIconColorsFromCanvas";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export function isBridgeScreenLocalCssPath(sourcePath: string, cssPath: string): boolean {
  const norm = cssPath.replace(/\\/g, "/");
  if (norm.includes("/tokens/")) return false;
  const screenDir = sourcePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "");
  return norm.startsWith(`${screenDir}/`);
}

/** Patch screen-local CSS with visual-only canvas styles (never token/global files). */
export function exportSafeBridgePageCss(input: {
  sourcePath: string;
  cssPaths: string[];
  cssFiles: { path: string; content: string }[];
  nodes: Record<string, EditorNode>;
  designTokens: Record<string, DesignToken>;
}): { path: string; content: string }[] {
  const allowed = new Set(
    input.cssPaths.filter((p) => isBridgeScreenLocalCssPath(input.sourcePath, p)),
  );
  const localFiles = input.cssFiles.filter((f) => allowed.has(f.path));
  if (localFiles.length === 0) return [];

  const iconColors = collectIconColorSelectorUpdates(input.nodes, input.designTokens);

  return exportPageCssFiles({
    nodes: input.nodes,
    designTokens: input.designTokens,
    originalCssFiles: localFiles,
    filterDeclarations: filterBridgeSafeCssDeclarations,
    extraSelectorUpdates: iconColors,
  }).filter((file) => {
    const original = localFiles.find((f) => f.path === file.path);
    return original?.content !== file.content;
  });
}
