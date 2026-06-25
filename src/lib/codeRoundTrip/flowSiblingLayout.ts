import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  nodeMatchesCssRule,
  parsePageCssRules,
  type PageCssRule,
} from "@/lib/codeRoundTrip/parsePageCss";
import { resolveCssDeclarations } from "@/lib/codeRoundTrip/resolveCssVariables";
import { isPhoneShellBottomChrome } from "@/lib/webImport/phoneShellBottomChrome";

export type FlowMargins = { top: number; right: number; bottom: number; left: number };

function parsePxValue(v: string | undefined): number {
  if (!v?.trim()) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function parseMarginSide(
  declarations: Record<string, string>,
  side: "top" | "right" | "bottom" | "left",
): number {
  const direct = declarations[`margin-${side}`];
  if (direct) return parsePxValue(direct);

  const shorthand = declarations.margin;
  if (!shorthand) return 0;
  const parts = shorthand.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parsePxValue(parts[0]);
  if (parts.length === 2) {
    return side === "top" || side === "bottom" ? parsePxValue(parts[0]) : parsePxValue(parts[1]);
  }
  if (parts.length === 3) {
    if (side === "top") return parsePxValue(parts[0]);
    if (side === "left" || side === "right") return parsePxValue(parts[1]);
    return parsePxValue(parts[2]);
  }
  if (parts.length >= 4) {
    if (side === "top") return parsePxValue(parts[0]);
    if (side === "right") return parsePxValue(parts[1]);
    if (side === "bottom") return parsePxValue(parts[2]);
    return parsePxValue(parts[3]);
  }
  return 0;
}

function pickBestRules(codeClassName: string, rules: PageCssRule[]): PageCssRule[] {
  const matched = rules.filter((r) => nodeMatchesCssRule(codeClassName, r));
  matched.sort((a, b) => a.classes.length - b.classes.length);
  return matched;
}

export function marginsForNode(
  node: EditorNode,
  rules: PageCssRule[],
  cssSources: string[],
  theme: "light" | "dark" = "dark",
): FlowMargins {
  if (!node.codeClassName) return { top: 0, right: 0, bottom: 0, left: 0 };
  const matched = pickBestRules(node.codeClassName, rules);
  const out: FlowMargins = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const rule of matched) {
    const decl = resolveCssDeclarations(rule.declarations, cssSources, theme);
    out.top = Math.max(out.top, parseMarginSide(decl, "top"));
    out.right = Math.max(out.right, parseMarginSide(decl, "right"));
    out.bottom = Math.max(out.bottom, parseMarginSide(decl, "bottom"));
    out.left = Math.max(out.left, parseMarginSide(decl, "left"));
  }
  return out;
}

function isInBottomChromeSubtree(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): boolean {
  let cur: EditorNode | undefined = nodes[nodeId];
  while (cur) {
    if (isPhoneShellBottomChrome(cur.codeClassName, cur.codeJsxTag)) return true;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return false;
}

function isFlowParent(node: EditorNode | undefined): boolean {
  if (!node) return false;
  const cc = node.codeClassName ?? "";
  if (/\bpml-(?:home|more|signup|stocks|onboarding)\b/.test(cc) && !cc.includes("__")) return true;
  if (cc.includes("__scroll") || cc.endsWith("-scroll")) return true;
  const mode = node.layoutMode ?? "none";
  return mode === "vertical" || mode === "horizontal";
}

/** Re-stack flow children using measured heights, layoutGap, and page CSS margins. */
export function relayoutFlowChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  cssSources: string[] = [],
): Record<string, EditorNode> {
  if (cssSources.length === 0) {
    return relayoutFlowChildrenFromNodes(nodes, childOrder, []);
  }
  const rules = cssSources.flatMap((css) => (css?.trim() ? parsePageCssRules(css) : []));
  return relayoutFlowChildrenFromNodes(nodes, childOrder, rules, cssSources);
}

function relayoutFlowChildrenFromNodes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rules: PageCssRule[],
  cssSources: string[] = [],
): Record<string, EditorNode> {
  const next: Record<string, EditorNode> = { ...nodes };

  const relayoutParent = (parentId: string) => {
    const parent = next[parentId];
    if (!isFlowParent(parent) || isInBottomChromeSubtree(parentId, next)) return;

    const kids = (childOrder[parentId] ?? []).filter((id) => next[id]?.visible !== false);
    if (kids.length < 2) return;

    const mode = parent!.layoutMode === "horizontal" ? "horizontal" : "vertical";
    const gap = parent!.layoutGap ?? 0;
    const padTop = parent!.paddingTop ?? 0;
    const padLeft = parent!.paddingLeft ?? 0;

    if (mode === "vertical") {
      let cursorY = padTop;
      for (const cid of kids) {
        const child = next[cid]!;
        const margin = marginsForNode(child, rules, cssSources);
        cursorY += margin.top;
        next[cid] = { ...child, y: cursorY };
        cursorY += child.height + gap + margin.bottom;
      }
      return;
    }

    let cursorX = padLeft;
    for (const cid of kids) {
      const child = next[cid]!;
      const margin = marginsForNode(child, rules, cssSources);
      cursorX += margin.left;
      next[cid] = { ...child, x: cursorX };
      cursorX += child.width + gap + margin.right;
    }
  };

  const walk = (parentId: string) => {
    for (const cid of childOrder[parentId] ?? []) walk(cid);
    relayoutParent(parentId);
  };

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) walk(rootId);
  return next;
}

export function relayoutFlowChildrenInSlice(
  slice: EditorPersistSlice,
  cssSources: string[],
): EditorPersistSlice {
  return {
    ...slice,
    nodes: relayoutFlowChildren(slice.nodes, slice.childOrder, cssSources),
  };
}
