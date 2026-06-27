import {
  colorTokenMatchKey,
  cssVarTokenId,
  tokenColorMatchKeys,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import {
  nodeMatchesCssRule,
  parsePageCssRules,
  type PageCssRule,
} from "@/lib/codeRoundTrip/parsePageCss";
import type { CanvasColorMode, DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export type TokenizeImportedNodesOptions = {
  /** Theme used during live capture / import — disambiguates shared hex across light/dark stops. */
  importMode?: CanvasColorMode;
  /** Page + token CSS for className → var(--token) binding. */
  cssSources?: string[];
};

export type ColorTokenHint = "text" | "fill" | "stroke" | "icon";

const COLOR_HINT_PREFIXES: Record<ColorTokenHint, string[]> = {
  text: ["text-", "icon-"],
  fill: ["background-", "surface-", "colour-", "brand-", "glass-"],
  stroke: ["border-"],
  icon: ["icon-", "text-"],
};

const CSS_VAR_REF_RE = /var\(\s*(--[\w-]+)/;

function colorStopForMatchKey(
  token: DesignToken,
  key: string,
): "light" | "dark" | null {
  if (token.type !== "color") return null;
  const v = token.value as ColorTokenValue;
  if (colorTokenMatchKey(v.hex, v.opacity) === key) return "light";
  if (v.dark?.hex && colorTokenMatchKey(v.dark.hex, v.dark.opacity) === key) return "dark";
  return null;
}

function pickBestCssRules(codeClassName: string, rules: PageCssRule[]): PageCssRule[] {
  const matched = rules.filter((r) => nodeMatchesCssRule(codeClassName, r));
  matched.sort((a, b) => a.classes.length - b.classes.length);
  return matched;
}

function varNameFromCssValue(value: string): string | undefined {
  const m = value.match(CSS_VAR_REF_RE);
  return m?.[1];
}

/** Map utility/BEM class names to library tokens (e.g. `text-neutral-strong`). */
export function pickColorTokenFromClassNames(
  codeClassName: string | undefined,
  tokens: Record<string, DesignToken>,
): string | undefined {
  if (!codeClassName?.trim()) return undefined;
  const classes = codeClassName.split(/\s+/).filter(Boolean);

  for (const cls of classes) {
    const byId = cssVarTokenId(`--${cls}`);
    if (tokens[byId]?.type === "color") return byId;
  }

  for (const cls of classes) {
    const match = Object.values(tokens).find((t) => t.type === "color" && t.name === cls);
    if (match) return match.id;
  }

  return undefined;
}

/** Resolve `fillTokenId` from page CSS rules matching `codeClassName`. */
export function pickColorTokenFromPageCss(
  codeClassName: string | undefined,
  cssSources: string[],
  tokens: Record<string, DesignToken>,
  properties: string[],
): string | undefined {
  if (!codeClassName?.trim() || cssSources.length === 0) return undefined;

  const rules: PageCssRule[] = [];
  for (const css of cssSources) {
    if (css?.trim()) rules.push(...parsePageCssRules(css));
  }
  const matched = pickBestCssRules(codeClassName, rules);
  for (let i = matched.length - 1; i >= 0; i--) {
    const rule = matched[i]!;
    for (const prop of properties) {
      const raw = rule.declarations[prop];
      if (!raw) continue;
      const varName = varNameFromCssValue(raw);
      if (!varName) continue;
      const id = cssVarTokenId(varName);
      if (tokens[id]?.type === "color") return id;
    }
  }

  for (const cls of codeClassName.split(/\s+/).filter(Boolean)) {
    const singleClassRules = rules.filter((r) => r.classes.length === 1 && r.classes[0] === cls);
    singleClassRules.sort((a, b) => a.selector.length - b.selector.length);
    for (let i = singleClassRules.length - 1; i >= 0; i--) {
      const rule = singleClassRules[i]!;
      for (const prop of properties) {
        const raw = rule.declarations[prop];
        if (!raw) continue;
        const varName = varNameFromCssValue(raw);
        if (!varName) continue;
        const id = cssVarTokenId(varName);
        if (tokens[id]?.type === "color") return id;
      }
    }
  }

  return undefined;
}

export function pickColorTokenId(
  hex: string | undefined,
  opacity: number | undefined,
  tokens: Record<string, DesignToken>,
  hint: ColorTokenHint,
  importMode: CanvasColorMode = "light",
): string | undefined {
  if (!hex?.trim()) return undefined;
  const key = colorTokenMatchKey(hex, opacity);
  const candidates = Object.values(tokens).filter((t) => tokenColorMatchKeys(t).includes(key));
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0]!.id;

  const modeAligned = candidates.filter((c) => colorStopForMatchKey(c, key) === importMode);
  const pool = modeAligned.length > 0 ? modeAligned : candidates;

  for (const prefix of COLOR_HINT_PREFIXES[hint]) {
    const match = pool.find((c) => c.name.startsWith(prefix));
    if (match) return match.id;
  }

  const semantic = pool.find((c) => !c.name.startsWith("primitive-"));
  return semantic?.id ?? pool[0]!.id;
}

/** Best color token for a text layer (class → page CSS → mode-aware hex). */
export function pickTextColorTokenId(
  node: Pick<EditorNode, "codeClassName" | "textColor" | "fill" | "fillOpacity" | "fillTokenId">,
  tokens: Record<string, DesignToken>,
  cssSources: string[] | undefined,
  colorMode: CanvasColorMode,
): string | undefined {
  if (node.fillTokenId && tokens[node.fillTokenId]?.type === "color") {
    return node.fillTokenId;
  }
  if (cssSources?.length) {
    const fromCss = pickColorTokenFromPageCss(
      node.codeClassName,
      cssSources,
      tokens,
      ["color"],
    );
    if (fromCss) return fromCss;
  }
  const fromClass = pickColorTokenFromClassNames(node.codeClassName, tokens);
  if (fromClass) return fromClass;
  return pickColorTokenId(
    node.textColor ?? node.fill,
    node.fillOpacity,
    tokens,
    "text",
    colorMode,
  );
}

/** Best color token for a fill layer (class → page CSS → mode-aware hex). */
export function pickFillColorTokenId(
  node: Pick<
    EditorNode,
    "type" | "codeClassName" | "fill" | "fillOpacity" | "opacity" | "fillTokenId" | "fillEnabled"
  >,
  tokens: Record<string, DesignToken>,
  cssSources: string[] | undefined,
  colorMode: CanvasColorMode,
): string | undefined {
  if (node.type === "text") return undefined;

  if (node.fillTokenId && tokens[node.fillTokenId]?.type === "color") {
    return node.fillTokenId;
  }
  if (cssSources?.length) {
    const fromCss = pickColorTokenFromPageCss(
      node.codeClassName,
      cssSources,
      tokens,
      ["background", "background-color"],
    );
    if (fromCss) return fromCss;
  }
  if (node.fillEnabled === false || !node.fill?.trim()) return undefined;
  const fromClass = pickColorTokenFromClassNames(node.codeClassName, tokens);
  if (fromClass) return fromClass;
  return pickColorTokenId(
    node.fill,
    node.fillOpacity ?? node.opacity,
    tokens,
    colorHintForNode(node as EditorNode),
    colorMode,
  );
}

export function colorHintForNode(node: EditorNode): ColorTokenHint {
  if (node.type === "text") return "text";
  const cls = node.codeClassName ?? "";
  if (/\bicon|svg|path\b/i.test(cls) || node.type === "path") return "icon";
  return "fill";
}
