import type { EditorNode } from "@/stores/useEditorStore";
import {
  pickFillColorTokenId,
  pickTextColorTokenId,
  type TokenizeImportedNodesOptions,
} from "@/lib/colorTokenMatching";
import type { DesignToken } from "@/lib/designTokens";
import {
  isTypographyUtilityClassName,
  typographyClassToTokenId,
  typographyMatchesNode,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";

export type { TokenizeImportedNodesOptions };

function pickTypographyTokenId(
  node: EditorNode,
  tokens: Record<string, DesignToken>,
): string | undefined {
  const classes = (node.codeClassName ?? "").split(/\s+/).filter(Boolean);

  const utilityClasses = classes.filter(isTypographyUtilityClassName);
  for (const cls of utilityClasses) {
    const id = typographyClassToTokenId(cls);
    if (tokens[id]?.type === "typography") return id;
  }

  for (const cls of classes) {
    const id = typographyClassToTokenId(cls);
    if (tokens[id]?.type === "typography") return id;
  }

  const typoTokens = Object.values(tokens).filter((t) => t.type === "typography");
  const matched = typoTokens.filter((t) => typographyMatchesNode(t, node));
  if (matched.length === 1) return matched[0]!.id;
  if (matched.length > 1) {
    matched.sort((a, b) => {
      const aUtility = isTypographyUtilityClassName(a.name) ? 0 : 1;
      const bUtility = isTypographyUtilityClassName(b.name) ? 0 : 1;
      return aUtility - bUtility || a.name.length - b.name.length;
    });
    return matched[0]!.id;
  }
  return undefined;
}

function pickSpacingTokenId(
  value: number | undefined,
  tokens: Record<string, DesignToken>,
): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  const matches = Object.values(tokens).filter(
    (t) => t.type === "spacing" && t.value && "value" in t.value && t.value.value === rounded,
  );
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => {
    const aSemantic = a.name.startsWith("spacing-") ? 0 : 1;
    const bSemantic = b.name.startsWith("spacing-") ? 0 : 1;
    return aSemantic - bSemantic || a.name.length - b.name.length;
  });
  return matches[0]!.id;
}

/** Bind imported canvas nodes to project CSS tokens instead of leaving raw hex values. */
export function tokenizeImportedNodes(
  nodes: Record<string, EditorNode>,
  designTokens: Record<string, DesignToken>,
  options: TokenizeImportedNodesOptions = {},
): Record<string, EditorNode> {
  if (Object.keys(designTokens).length === 0) return nodes;

  const importMode = options.importMode ?? "light";
  const cssSources = (options.cssSources ?? []).filter((c) => c?.trim());

  const next: Record<string, EditorNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    let patched: EditorNode = { ...node };

    if (node.type === "text") {
      const textToken = pickTextColorTokenId(node, designTokens, cssSources, importMode);
      if (textToken) {
        patched = { ...patched, fillTokenId: textToken };
      }

      const typoToken = pickTypographyTokenId(node, designTokens);
      if (typoToken) {
        patched = { ...patched, textStyleTokenId: typoToken };
      }
    } else {
      const fillToken = pickFillColorTokenId(node, designTokens, cssSources, importMode);
      if (fillToken) {
        patched = {
          ...patched,
          fillTokenId: fillToken,
          fillEnabled: patched.fillEnabled === false ? false : true,
        };
      }
    }

    if (node.type === "frame" || node.type === "group") {
      const spacingRefs: NonNullable<EditorNode["projectSpacingTokenIds"]> = {};
      const pt = pickSpacingTokenId(node.paddingTop, designTokens);
      const pr = pickSpacingTokenId(node.paddingRight, designTokens);
      const pb = pickSpacingTokenId(node.paddingBottom, designTokens);
      const pl = pickSpacingTokenId(node.paddingLeft, designTokens);
      const gap = pickSpacingTokenId(node.layoutGap, designTokens);
      const radius = pickSpacingTokenId(node.cornerRadius, designTokens);
      if (pt) spacingRefs.paddingTop = pt;
      if (pr) spacingRefs.paddingRight = pr;
      if (pb) spacingRefs.paddingBottom = pb;
      if (pl) spacingRefs.paddingLeft = pl;
      if (gap) spacingRefs.layoutGap = gap;
      if (radius) spacingRefs.cornerRadius = radius;
      if (Object.keys(spacingRefs).length > 0) {
        patched = { ...patched, projectSpacingTokenIds: spacingRefs };
      }
    }

    next[id] = patched;
  }

  return next;
}
