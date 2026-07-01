import {
  pickFillColorTokenId,
  pickTextColorTokenId,
  pickColorTokenId,
  colorHintForNode,
} from "@/lib/colorTokenMatching";
import type { PageCssRule } from "@/lib/codeRoundTrip/parsePageCss";
import {
  colorTokenHasDarkMode,
  isColorValue,
  type CanvasColorMode,
  type ColorTokenValue,
  type DesignToken,
} from "@/lib/designTokens";
import { colorTokenMatchKey, tokenColorMatchKeys } from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import type { EditorNode } from "@/stores/useEditorStore";

const CSS_VAR_REF_RE = /var\(\s*(--[\w-]+)/;

const THEME_COLOR_PROPS = [
  "color",
  "background",
  "background-color",
  "border-color",
] as const;

function originalRuleValue(rule: PageCssRule | null, prop: string): string | undefined {
  if (!rule) return undefined;
  if (rule.declarations[prop]) return rule.declarations[prop];
  if (prop === "background" && rule.declarations["background-color"]) {
    return rule.declarations["background-color"];
  }
  return undefined;
}

function nodeColorMatchesToken(
  hex: string | undefined,
  opacity: number | undefined,
  token: DesignToken,
): boolean {
  if (!hex?.trim() || token.type !== "color" || !isColorValue(token.value)) return false;
  const key = colorTokenMatchKey(hex, opacity);
  return tokenColorMatchKeys(token).includes(key);
}

function linkedCssVarTokenId(
  node: EditorNode,
  tokens: Record<string, DesignToken>,
  cssSources: string[],
  canvasColorMode: CanvasColorMode,
): string | undefined {
  if (node.type === "text") {
    return pickTextColorTokenId(node, tokens, cssSources, canvasColorMode);
  }
  return pickFillColorTokenId(node, tokens, cssSources, canvasColorMode);
}

function cssVarReference(token: DesignToken): string | null {
  if (token.type !== "color") return null;
  const name = token.name?.trim();
  if (!name) return null;
  return `var(--${name})`;
}

/** Never bake light/dark hex over semantic CSS variables when syncing canvas → code. */
export function stripBridgeThemeSensitiveCssColors(
  node: EditorNode,
  decls: Record<string, string>,
  opts: {
    designTokens: Record<string, DesignToken>;
    cssSources: string[];
    matchedRule: PageCssRule | null;
    canvasColorMode: CanvasColorMode;
  },
): Record<string, string> {
  const out = { ...decls };
  const tokenId = linkedCssVarTokenId(
    node,
    opts.designTokens,
    opts.cssSources,
    opts.canvasColorMode,
  );
  const linkedToken = tokenId ? opts.designTokens[tokenId] : undefined;
  const dualModeCssVar =
    tokenId?.startsWith("css-var-") &&
    linkedToken?.type === "color" &&
    colorTokenHasDarkMode(linkedToken.value as ColorTokenValue);

  for (const prop of THEME_COLOR_PROPS) {
    if (!(prop in out)) continue;

    const orig = originalRuleValue(opts.matchedRule, prop);
    if (orig && CSS_VAR_REF_RE.test(orig)) {
      const sampleHex =
        node.type === "text"
          ? node.textColor ?? node.fill
          : prop === "border-color"
            ? node.strokeColor
            : node.fill;
      const sampleOpacity =
        node.type === "text"
          ? node.fillOpacity
          : prop === "border-color"
            ? node.strokeOpacity ?? node.opacity
            : node.fillOpacity ?? node.opacity;
      const customized =
        dualModeCssVar &&
        linkedToken &&
        sampleHex?.trim() &&
        !nodeColorMatchesToken(sampleHex, sampleOpacity, linkedToken);
      if (!customized) {
        delete out[prop];
      }
      continue;
    }

    if (!dualModeCssVar || !linkedToken) continue;

    const sampleHex =
      node.type === "text"
        ? node.textColor ?? node.fill
        : prop === "border-color"
          ? node.strokeColor
          : node.fill;
    const sampleOpacity =
      node.type === "text"
        ? node.fillOpacity
        : prop === "border-color"
          ? node.strokeOpacity ?? node.opacity
          : node.fillOpacity ?? node.opacity;

    if (nodeColorMatchesToken(sampleHex, sampleOpacity, linkedToken)) {
      delete out[prop];
      continue;
    }

    const varRef = cssVarReference(linkedToken);
    if (varRef && !orig) {
      out[prop] = varRef;
    }
  }

  return out;
}

/** Map icon path tint → CSS `color` value, preserving dual-mode token vars. */
export function bridgeIconColorExportValue(
  hex: string,
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
  canvasColorMode: CanvasColorMode,
): string {
  const tokenId = pickColorTokenId(
    hex,
    node.fillOpacity ?? node.opacity,
    designTokens,
    colorHintForNode(node),
    canvasColorMode,
  );
  if (!tokenId?.startsWith("css-var-")) return hex;
  const tok = designTokens[tokenId];
  if (tok?.type !== "color" || !colorTokenHasDarkMode(tok.value as ColorTokenValue)) {
    return hex;
  }
  return cssVarReference(tok) ?? hex;
}

function dualModeColorToken(
  tokenId: string | undefined,
  designTokens: Record<string, DesignToken>,
): DesignToken | null {
  if (!tokenId) return null;
  const tok = designTokens[tokenId];
  if (tok?.type !== "color" || !isColorValue(tok.value)) return null;
  if (!colorTokenHasDarkMode(tok.value)) return null;
  if (!tok.name?.trim()) return null;
  return tok;
}

function dualModeCssVarToken(
  tokenId: string | undefined,
  designTokens: Record<string, DesignToken>,
): DesignToken | null {
  if (!tokenId?.startsWith("css-var-")) return null;
  return dualModeColorToken(tokenId, designTokens);
}

function themeSafeCssVarForNodeColor(
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
  canvasColorMode: CanvasColorMode,
  cssSources: string[],
  kind: "fill" | "text",
): string | null {
  const explicitTokenId = node.fillTokenId;
  const inferredTokenId =
    kind === "text"
      ? pickTextColorTokenId(node, designTokens, cssSources, canvasColorMode)
      : pickFillColorTokenId(node, designTokens, cssSources, canvasColorMode);
  const tokenId = explicitTokenId ?? inferredTokenId ?? undefined;

  // Library-applied token: keep var() even when baked fill hex was not synced on apply.
  if (explicitTokenId && tokenId === explicitTokenId) {
    const explicit = dualModeColorToken(explicitTokenId, designTokens);
    if (explicit) return cssVarReference(explicit);
  }

  const tok = dualModeCssVarToken(tokenId, designTokens);
  if (!tok) return null;

  const sampleHex = kind === "text" ? (node.textColor ?? node.fill) : node.fill;
  const sampleOpacity =
    kind === "text" ? node.fillOpacity : (node.fillOpacity ?? node.opacity);
  if (sampleHex?.trim() && !nodeColorMatchesToken(sampleHex, sampleOpacity, tok)) {
    return null;
  }

  return cssVarReference(tok);
}

/** Inline fill for canvas-added layers — use CSS vars so dark mode follows the app theme. */
export function bridgeThemeSafeFillExportValue(
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
  canvasColorMode: CanvasColorMode,
  cssSources: string[] = [],
): string | null {
  if (node.type === "text") return null;
  return themeSafeCssVarForNodeColor(node, designTokens, canvasColorMode, cssSources, "fill");
}

/** Inline text color for canvas-added text — preserve dual-mode token vars. */
export function bridgeThemeSafeTextColorExportValue(
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
  canvasColorMode: CanvasColorMode,
  cssSources: string[] = [],
): string | null {
  if (node.type !== "text") return null;
  return themeSafeCssVarForNodeColor(node, designTokens, canvasColorMode, cssSources, "text");
}
