import type { FontResolutionInfo } from "./canonicalTextLayout";

export type FontWarning = FontResolutionInfo & {
  nodeId: string;
  lastSeen: number;
};

const warnings = new Map<string, FontWarning>();

export function recordFontResolution(nodeId: string, font: FontResolutionInfo): void {
  if (!font.missing && !font.fallbackUsed) {
    warnings.delete(nodeId);
    return;
  }
  warnings.set(nodeId, {
    ...font,
    nodeId,
    lastSeen: Date.now(),
  });
}

export function getMissingFontWarnings(): FontWarning[] {
  return [...warnings.values()].filter((w) => w.missing);
}

export function getFontWarnings(): FontWarning[] {
  return [...warnings.values()];
}

export function clearFontWarnings(nodeId?: string): void {
  if (!nodeId) {
    warnings.clear();
    return;
  }
  warnings.delete(nodeId);
}

/** Resolve import font without blindly replacing with Inter — preserve original family name. */
export function preserveImportFontFamily(computedFamily: string): string {
  const primary = computedFamily
    .split(",")
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ""))
    .find((part) => part && !part.toLowerCase().startsWith("var("));
  if (!primary) return computedFamily;
  // "Inter Subset" (and other Inter variants) are subsetted Inter — Craft bundles real
  // Inter via next/font, which registers under a HASHED family name reachable only through
  // `var(--font-inter)`. Emit that token first so the canvas uses the real Inter face and
  // captured text metrics match the browser/Figma (the literal "Inter" alone falls back to a
  // wider system font). See canvasFontFamilyStack.
  if (primary.toLowerCase().includes("inter")) {
    return `var(--font-inter), Inter, system-ui, sans-serif`;
  }
  return `${primary}, var(--font-inter), Inter, system-ui, sans-serif`;
}
