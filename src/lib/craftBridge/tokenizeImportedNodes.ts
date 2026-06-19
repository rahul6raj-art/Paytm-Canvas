import {
  colorTokenMatchKey,
  isTypographyUtilityClassName,
  tokenColorMatchKey,
  typographyClassToTokenId,
  typographyMatchesNode,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export type ColorTokenHint = "text" | "fill" | "stroke" | "icon";

const COLOR_HINT_PREFIXES: Record<ColorTokenHint, string[]> = {
  text: ["text-", "icon-"],
  fill: ["background-", "surface-", "colour-", "brand-", "glass-"],
  stroke: ["border-"],
  icon: ["icon-", "text-"],
};

function pickColorTokenId(
  hex: string | undefined,
  opacity: number | undefined,
  tokens: Record<string, DesignToken>,
  hint: ColorTokenHint,
): string | undefined {
  if (!hex?.trim()) return undefined;
  const key = colorTokenMatchKey(hex, opacity);
  const candidates = Object.values(tokens).filter((t) => tokenColorMatchKey(t) === key);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0]!.id;

  for (const prefix of COLOR_HINT_PREFIXES[hint]) {
    const match = candidates.find((c) => c.name.startsWith(prefix));
    if (match) return match.id;
  }

  const semantic = candidates.find((c) => !c.name.startsWith("primitive-"));
  return semantic?.id ?? candidates[0]!.id;
}

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

function colorHintForNode(node: EditorNode): ColorTokenHint {
  if (node.type === "text") return "text";
  const cls = node.codeClassName ?? "";
  if (/\bicon|svg|path\b/i.test(cls) || node.type === "path") return "icon";
  return "fill";
}

/** Bind imported canvas nodes to project CSS tokens instead of leaving raw hex values. */
export function tokenizeImportedNodes(
  nodes: Record<string, EditorNode>,
  designTokens: Record<string, DesignToken>,
): Record<string, EditorNode> {
  if (Object.keys(designTokens).length === 0) return nodes;

  const next: Record<string, EditorNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    let patched: EditorNode = { ...node };

    if (node.type === "text") {
      const textHex = node.textColor ?? node.fill;
      const textToken = pickColorTokenId(textHex, node.fillOpacity, designTokens, "text");
      if (textToken) {
        patched = { ...patched, fillTokenId: textToken };
      }

      const typoToken = pickTypographyTokenId(node, designTokens);
      if (typoToken) {
        patched = { ...patched, textStyleTokenId: typoToken };
      }
    } else if (node.fillEnabled !== false && node.fill) {
      const fillToken = pickColorTokenId(
        node.fill,
        node.fillOpacity ?? node.opacity,
        designTokens,
        colorHintForNode(node),
      );
      if (fillToken) {
        patched = { ...patched, fillTokenId: fillToken };
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
