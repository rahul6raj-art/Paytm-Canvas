import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import { parseInlineCss } from "@/lib/codeImport/parseInlineCss";
import { reactStyleToNodePatch } from "@/lib/codeRoundTrip/reactStyleImport";
import { mergeStylePatches } from "@/lib/codeRoundTrip/reactClassNameImport";
import {
  nodeMatchesCssRule,
  parsePageCssRules,
  type PageCssRule,
} from "@/lib/codeRoundTrip/parsePageCss";
import { resolveCssDeclarations } from "@/lib/codeRoundTrip/resolveCssVariables";

function cssDeclarationsToPatch(declarations: Record<string, string>): Partial<EditorNode> {
  const cssText = Object.entries(declarations)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  return reactStyleToNodePatch(parseInlineCss(cssText));
}

function pickBestRules(codeClassName: string, rules: PageCssRule[]): PageCssRule[] {
  const matched = rules.filter((r) => nodeMatchesCssRule(codeClassName, r));
  matched.sort((a, b) => a.classes.length - b.classes.length);
  return matched;
}

/** Apply companion `.css` from a page folder onto imported nodes (match by className). */
export function applyPageCssToSlice(
  slice: EditorPersistSlice,
  cssSources: string[],
): EditorPersistSlice {
  if (!cssSources.length) return slice;

  const rules: PageCssRule[] = [];
  for (const css of cssSources) {
    if (css?.trim()) rules.push(...parsePageCssRules(css));
  }
  if (rules.length === 0) return slice;

  const nodes: Record<string, EditorNode> = { ...slice.nodes };
  for (const [id, node] of Object.entries(nodes)) {
    if (!node.codeClassName) continue;
    const matched = pickBestRules(node.codeClassName, rules);
    if (matched.length === 0) continue;

    let patch: Partial<EditorNode> = {};
    for (const rule of matched) {
      const resolved = resolveCssDeclarations(rule.declarations, cssSources, "dark");
      patch = mergeStylePatches(patch, cssDeclarationsToPatch(resolved));
    }
    if (Object.keys(patch).length === 0) continue;
    nodes[id] = { ...node, ...patch };
  }

  return { ...slice, nodes };
}
