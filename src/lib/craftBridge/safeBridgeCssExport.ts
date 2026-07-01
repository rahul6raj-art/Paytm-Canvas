import {
  exportPageCssFiles,
  filterBridgeSafeCssDeclarations,
} from "@/lib/codeRoundTrip/exportPageCss";
import {
  collectIconColorSelectorUpdates,
  isBottomNavChromeClassName,
} from "@/lib/craftBridge/exportIconColorsFromCanvas";
import { stripBridgeThemeSensitiveCssColors } from "@/lib/craftBridge/bridgeThemeSafeCssExport";
import type { CanvasColorMode, DesignToken } from "@/lib/designTokens";
import { parsePageCssRules } from "@/lib/codeRoundTrip/parsePageCss";
import type { EditorNode } from "@/stores/useEditorStore";

const CSS_VAR_REF_RE = /var\(\s*(--[\w-]+)/;

function filterIconColorsPreservingCssVars(
  iconColors: Map<string, Record<string, string>>,
  cssFiles: { content: string }[],
): Map<string, Record<string, string>> {
  const rules = cssFiles.flatMap((f) => (f.content?.trim() ? parsePageCssRules(f.content) : []));
  const out = new Map<string, Record<string, string>>();
  for (const [selector, decls] of iconColors) {
    const rule = rules.find((r) => r.selector === selector);
    const origColor = rule?.declarations.color;
    if (origColor && CSS_VAR_REF_RE.test(origColor)) {
      const nextColor = decls.color ?? "";
      if (!nextColor || nextColor.startsWith("var(")) continue;
    }
    out.set(selector, decls);
  }
  return out;
}

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
  canvasColorMode?: CanvasColorMode;
}): { path: string; content: string }[] {
  const allowed = new Set(
    input.cssPaths.filter((p) => isBridgeScreenLocalCssPath(input.sourcePath, p)),
  );
  const localFiles = input.cssFiles.filter((f) => allowed.has(f.path));
  if (localFiles.length === 0) return [];

  const cssSources = localFiles.map((f) => f.content).filter((c) => c?.trim());
  const canvasColorMode = input.canvasColorMode ?? "light";

  const iconColors = filterIconColorsPreservingCssVars(
    collectIconColorSelectorUpdates(input.nodes, input.designTokens, canvasColorMode),
    localFiles,
  );

  const exportNodes: Record<string, EditorNode> = {};
  for (const [id, node] of Object.entries(input.nodes)) {
    if (isBottomNavChromeClassName(node.codeClassName ?? "")) continue;
    exportNodes[id] = node;
  }

  return exportPageCssFiles({
    nodes: exportNodes,
    designTokens: input.designTokens,
    originalCssFiles: localFiles,
    filterDeclarations: filterBridgeSafeCssDeclarations,
    extraSelectorUpdates: iconColors,
    mapNodeDeclarations: (node, decls, ctx) =>
      stripBridgeThemeSensitiveCssColors(node, decls, {
        designTokens: input.designTokens,
        cssSources,
        matchedRule: ctx.matchedRule,
        canvasColorMode,
      }),
  }).filter((file) => {
    const original = localFiles.find((f) => f.path === file.path);
    return original?.content !== file.content;
  });
}
