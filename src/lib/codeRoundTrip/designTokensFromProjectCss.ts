import { normalizeHex, parseCssColor } from "@/lib/color";
import {
  designTokenTimestamp,
  isTypographyValue,
  type ColorTokenValue,
  type DesignToken,
  type TypographyTokenValue,
} from "@/lib/designTokens";
import { parsePageCssRules } from "@/lib/codeRoundTrip/parsePageCss";
import {
  parseCssCustomProperties,
  type CssThemeScope,
} from "@/lib/codeRoundTrip/parseCssCustomProperties";
import { resolveCssDeclarations, resolveCssValue } from "@/lib/codeRoundTrip/resolveCssVariables";
import { parsePx } from "@/lib/webImport/cssParseUtils";

export function cssVarTokenId(varName: string): string {
  const name = varName.startsWith("--") ? varName.slice(2) : varName;
  return `css-var-${name}`;
}

export function cssTypeTokenId(className: string): string {
  return `css-type-${className}`;
}

export function cssVarDisplayName(varName: string): string {
  return varName.startsWith("--") ? varName.slice(2) : varName;
}

function isTypographyCssSource(css: string): boolean {
  return /--font-size-|--font-family|\.body-|\.title-|\.display-/.test(css);
}

function isSpacingVarName(name: string): boolean {
  return (
    name.startsWith("spacing-") ||
    name.startsWith("unit-") ||
    name.startsWith("card-padding") ||
    name.startsWith("radius-") ||
    name.startsWith("border-width")
  );
}

function parseCssLengthPx(value: string, vars: Record<string, string>): number | null {
  const resolved = resolveCssValue(value, vars).trim();
  const px = parsePx(resolved);
  if (px != null) return Math.round(px);
  const num = parseFloat(resolved);
  return Number.isFinite(num) ? Math.round(num) : null;
}

function typographyTokensFromCssSources(
  cssSources: string[],
  vars: Record<string, string>,
  theme: CssThemeScope,
  now: string,
): Record<string, DesignToken> {
  const tokens: Record<string, DesignToken> = {};
  for (const css of cssSources) {
    if (!isTypographyCssSource(css)) continue;
    for (const rule of parsePageCssRules(css)) {
      if (rule.classes.length !== 1) continue;
      const className = rule.classes[0]!;
      if (!/^(display-|title-|body-|subtext-|caption-)/.test(className)) continue;
      const decls = resolveCssDeclarations(rule.declarations, cssSources, theme);
      const fontSize = parseCssLengthPx(decls["font-size"] ?? "", vars);
      const lineHeightPx = parseCssLengthPx(decls["line-height"] ?? "", vars);
      const fontWeight = parseInt(decls["font-weight"] ?? "400", 10);
      if (fontSize == null || !Number.isFinite(fontWeight)) continue;
      const fontFamily = (decls["font-family"] ?? "Inter, sans-serif")
        .split(",")[0]
        ?.replace(/['"]/g, "")
        .trim();
      const letterSpacingPx = parseCssLengthPx(decls["letter-spacing"] ?? "0", vars) ?? 0;
      const lineHeight =
        fontSize > 0 && lineHeightPx != null ? lineHeightPx / fontSize : 1.2;

      const value: TypographyTokenValue = {
        fontFamily: fontFamily || "Inter",
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing: letterSpacingPx,
      };
      const id = cssTypeTokenId(className);
      tokens[id] = {
        id,
        name: className,
        type: "typography",
        value,
        createdAt: now,
        updatedAt: now,
      };
    }
  }
  return tokens;
}

function spacingTokensFromCssVars(
  vars: Record<string, string>,
  now: string,
): Record<string, DesignToken> {
  const tokens: Record<string, DesignToken> = {};
  for (const [varName, rawValue] of Object.entries(vars)) {
    if (!varName.startsWith("--")) continue;
    const name = cssVarDisplayName(varName);
    if (!isSpacingVarName(name)) continue;
    const px = parseCssLengthPx(rawValue, vars);
    if (px == null || px < 0) continue;
    const id = cssVarTokenId(varName);
    tokens[id] = {
      id,
      name,
      type: "spacing",
      value: { value: px },
      createdAt: now,
      updatedAt: now,
    };
  }
  return tokens;
}

/** Build Craft design tokens from project `src/tokens/*.css` (colors, typography, spacing). */
export function projectDesignTokensFromCssSources(
  cssSources: string[],
  theme: CssThemeScope = "light",
): Record<string, DesignToken> {
  const scopes = parseCssCustomProperties(cssSources);
  const vars = { ...scopes.light, ...scopes[theme] };
  const now = designTokenTimestamp();
  const tokens: Record<string, DesignToken> = {};

  for (const [varName, rawValue] of Object.entries(vars)) {
    if (!varName.startsWith("--")) continue;
    const resolved = resolveCssValue(rawValue, vars).trim();
    const parsed = parseCssColor(resolved);
    if (!parsed) continue;

    const name = cssVarDisplayName(varName);
    const id = cssVarTokenId(varName);
    tokens[id] = {
      id,
      name,
      type: "color",
      value: {
        hex: parsed.hex,
        ...(parsed.opacity != null ? { opacity: parsed.opacity } : {}),
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  Object.assign(tokens, spacingTokensFromCssVars(vars, now));
  Object.assign(tokens, typographyTokensFromCssSources(cssSources, vars, theme, now));

  return tokens;
}

/** @deprecated Use projectDesignTokensFromCssSources */
export function designTokensFromProjectCss(
  cssSources: string[],
  theme: CssThemeScope = "light",
): Record<string, DesignToken> {
  return projectDesignTokensFromCssSources(cssSources, theme);
}

export function mergeDesignTokenRecords(
  base: Record<string, DesignToken> | undefined,
  incoming: Record<string, DesignToken>,
): Record<string, DesignToken> {
  return { ...(base ?? {}), ...incoming };
}

export function colorTokenMatchKey(hex: string, opacity?: number): string {
  const normalized = normalizeHex(hex) ?? hex.toLowerCase();
  const a = opacity ?? 1;
  return `${normalized}|${a.toFixed(3)}`;
}

export function tokenColorMatchKey(token: DesignToken): string | null {
  if (token.type !== "color") return null;
  const v = token.value as ColorTokenValue;
  return colorTokenMatchKey(v.hex, v.opacity);
}

export function typographyClassToTokenId(className: string): string {
  return cssTypeTokenId(className);
}

/** Project CSS utility classes like body-medium, title-4-bold, display-1-medium. */
export const TYPOGRAPHY_UTILITY_CLASS_RE =
  /^(display-\d|display-|title-\d|title-|body-|subtext-|caption-)/;

export function isTypographyUtilityClassName(className: string): boolean {
  return TYPOGRAPHY_UTILITY_CLASS_RE.test(className);
}

export function typographyMatchesNode(
  token: DesignToken,
  node: Pick<
    import("@/stores/useEditorStore").EditorNode,
    "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing"
  >,
): boolean {
  if (token.type !== "typography" || !isTypographyValue(token.value)) return false;
  const v = token.value;
  if (node.fontSize != null && Math.abs(node.fontSize - v.fontSize) > 1) return false;
  if (node.fontWeight != null && node.fontWeight !== v.fontWeight) return false;
  if (node.lineHeight != null && Math.abs(node.lineHeight - v.lineHeight) > 0.08) return false;
  if (
    node.letterSpacing != null &&
    Math.abs(node.letterSpacing - v.letterSpacing) > 0.5
  ) {
    return false;
  }
  return true;
}
