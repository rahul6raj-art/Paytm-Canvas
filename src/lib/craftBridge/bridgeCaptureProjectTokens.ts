import {
  parseCssCustomProperties,
  type CssThemeScope,
} from "@/lib/codeRoundTrip/parseCssCustomProperties";
import { resolveCssValue } from "@/lib/codeRoundTrip/resolveCssVariables";

const TEXTFIELD_FOCUS_STROKES = new Set([
  "#34a34d",
  "#47ff8e",
  "rgb(52,163,77)",
  "rgb(71,255,142)",
]);

/** Resolve a project CSS custom property from linked token / page stylesheets. */
export function resolveBridgeProjectCssVariable(
  cssSources: string[] | undefined,
  varName: `--${string}`,
  theme: CssThemeScope = "light",
): string | undefined {
  if (!cssSources?.length) return undefined;
  const scopes = parseCssCustomProperties(cssSources);
  const vars = scopes[theme];
  const resolved = resolveCssValue(`var(${varName})`, vars).trim();
  if (!resolved || resolved.startsWith("var(")) return undefined;
  return resolved;
}

export function isBridgeTextfieldFocusStroke(color?: string): boolean {
  if (!color?.trim()) return false;
  const compact = color.trim().toLowerCase().replace(/\s/g, "");
  return TEXTFIELD_FOCUS_STROKES.has(compact);
}

/**
 * Prefer Playwright-captured border color; swap focus-ring green for the project's
 * `--border-neutral-medium` token instead of a Craft hardcoded hex.
 */
export function resolveBridgeTextfieldBorderStrokeColor(
  capturedColor: string | undefined,
  cssSources: string[] | undefined,
  theme: CssThemeScope = "light",
): string | undefined {
  const tokenBorder = resolveBridgeProjectCssVariable(
    cssSources,
    "--border-neutral-medium",
    theme,
  );

  const trimmed = capturedColor?.trim();
  if (trimmed && !isBridgeTextfieldFocusStroke(trimmed)) return trimmed;
  return tokenBorder;
}
