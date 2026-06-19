import { fillCss } from "@/lib/color";
import { resolveNodeWithDesignTokens, type DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

/** Class tokens that control Icon/currentColor SVG tint in PML screens. */
const ICON_COLOR_HOST_TOKENS = [
  "header__icon-btn",
  "header__back-btn",
  "bn__icon-wrap",
  "__icon-wrap",
  "__icon-btn",
  "__back-btn",
  "__chevron",
  "__icon",
] as const;

function isIconColorHostClass(className: string): boolean {
  const tokens = className.split(/\s+/).filter(Boolean);
  return tokens.some((token) =>
    ICON_COLOR_HOST_TOKENS.some(
      (hint) => token === hint || token.endsWith(hint),
    ),
  );
}

function primaryIconHostClass(className: string): string | null {
  const tokens = className.split(/\s+/).filter(Boolean);
  for (const hint of ICON_COLOR_HOST_TOKENS) {
    const match = tokens.find((t) => t === hint || t.endsWith(hint));
    if (match) return match;
  }
  return null;
}

function findIconColorHost(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): EditorNode | null {
  let cur = nodes[nodeId];
  while (cur?.parentId) {
    const parent = nodes[cur.parentId];
    if (!parent) break;
    const cls = parent.codeClassName ?? "";
    if (cls && isIconColorHostClass(cls)) return parent;
    cur = parent;
  }
  return null;
}

function iconPathColor(
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
): string | null {
  if (node.type !== "path") return null;
  const resolved = resolveNodeWithDesignTokens(node, designTokens);

  if (resolved.fillEnabled !== false && resolved.fill) {
    const css = fillCss(resolved.fill, resolved.fillOpacity ?? resolved.opacity, true);
    if (css && css !== "transparent") return css;
  }

  if (resolved.strokeEnabled !== false && resolved.strokeColor) {
    const css = fillCss(resolved.strokeColor, resolved.strokeOpacity ?? resolved.opacity, true);
    if (css && css !== "transparent") return css;
  }

  return null;
}

/**
 * Map edited SVG path fills on canvas → `color` on the nearest icon wrapper class
 * (matches PML Icon components that use fill="currentColor").
 */
export function collectIconColorSelectorUpdates(
  nodes: Record<string, EditorNode>,
  designTokens: Record<string, DesignToken>,
): Map<string, Record<string, string>> {
  const updates = new Map<string, Record<string, string>>();

  for (const node of Object.values(nodes)) {
    const color = iconPathColor(node, designTokens);
    if (!color) continue;

    const host = findIconColorHost(node.id, nodes);
    if (!host?.codeClassName) continue;

    const hostClass = primaryIconHostClass(host.codeClassName);
    if (!hostClass) continue;

    const selector = `.${hostClass}`;
    const prev = updates.get(selector) ?? {};
    updates.set(selector, { ...prev, color });
  }

  return updates;
}
