import { GOOGLE_FONTS, cssFamilyForGoogleFont } from "./googleFonts";
import { SYSTEM_FONT_OPTIONS } from "./systemFonts";

export type FontSource = "google" | "system" | "installed" | "uploaded";

export type FontFamilyOption = {
  id: string;
  label: string;
  value: string;
  source: FontSource;
  /** Primary face name used for loading / preview. */
  primary: string;
};

export type FontCatalogGroup = {
  id: FontSource;
  label: string;
  fonts: FontFamilyOption[];
};

const googleOptions: FontFamilyOption[] = GOOGLE_FONTS.map((entry) => ({
  id: `google-${entry.name.replace(/\s+/g, "-").toLowerCase()}`,
  label: entry.name,
  value: cssFamilyForGoogleFont(entry),
  source: "google" as const,
  primary: entry.name,
}));

let cachedCatalog: FontCatalogGroup[] | null = null;
let installedFontsCache: FontFamilyOption[] = [];
let uploadedFontsCache: FontFamilyOption[] = [];

export function setInstalledFontOptions(fonts: FontFamilyOption[]): void {
  installedFontsCache = fonts;
  cachedCatalog = null;
}

export function setUploadedFontOptions(fonts: FontFamilyOption[]): void {
  uploadedFontsCache = fonts;
  cachedCatalog = null;
}

export function buildFontCatalog(
  installed: FontFamilyOption[] = installedFontsCache,
  uploaded: FontFamilyOption[] = uploadedFontsCache,
): FontCatalogGroup[] {
  if (cachedCatalog && installed === installedFontsCache && uploaded === uploadedFontsCache) {
    return cachedCatalog;
  }

  const installedSorted = [...installed].sort((a, b) => a.label.localeCompare(b.label));
  const uploadedSorted = [...uploaded].sort((a, b) => a.label.localeCompare(b.label));

  cachedCatalog = [
    { id: "uploaded", label: "Uploaded fonts", fonts: uploadedSorted },
    { id: "installed", label: "Installed on this device", fonts: installedSorted },
    { id: "google", label: "Open source (Google Fonts)", fonts: googleOptions },
    { id: "system", label: "System & generic", fonts: SYSTEM_FONT_OPTIONS },
  ];
  return cachedCatalog;
}

export function flattenFontCatalog(groups: FontCatalogGroup[]): FontFamilyOption[] {
  const out: FontFamilyOption[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const f of g.fonts) {
      const key = f.value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

export function filterFontCatalog(
  groups: FontCatalogGroup[],
  query: string,
): FontCatalogGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      fonts: g.fonts.filter(
        (f) => f.label.toLowerCase().includes(q) || f.primary.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.fonts.length > 0);
}

/** First usable family name in a CSS stack (skips `var(...)` tokens). */
export function primaryFontName(fontFamily: string): string {
  const parts = fontFamily.split(",").map((p) => p.trim().replace(/^['"]|['"]$/g, ""));
  for (const part of parts) {
    if (!part || /^var\s*\(/i.test(part)) continue;
    return part;
  }
  return "sans-serif";
}

/**
 * Resolve a `var(--name, fallback)` font token to the concrete family name(s) the browser
 * actually loaded. Critical for fonts injected via `next/font`, which register under a HASHED
 * family name (e.g. `__Inter_xxxx`) exposed only through the CSS variable — the literal "Inter"
 * is NOT a usable canvas family, so without this the canvas falls back to a wider system font
 * and text measures/renders wider than the DOM (and Figma). Returns null when there is no DOM
 * (SSR / bridge import) or the variable is unset.
 */
/** Split a CSS font-family list on top-level commas only (keeps `var(--x, fallback)` intact). */
function splitFontList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function resolveCssVarFontValue(varExpr: string): string | null {
  const match = varExpr.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/i);
  if (!match) return null;
  const fallback = match[2]?.trim() || null;
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") {
    return fallback;
  }
  try {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(match[1]!)
      .trim();
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Font stack for Canvas 2D `ctx.font`. CSS variables are resolved to the concrete loaded family
 * (see {@link resolveCssVarFontValue}) so the canvas uses the exact same font face as the DOM —
 * e.g. the real `next/font` Inter — instead of falling back to a wider system font.
 */
export function canvasFontFamilyStack(fontFamily: string): string {
  const names: string[] = [];
  const pushName = (raw: string): void => {
    const name = raw.trim().replace(/^['"]|['"]$/g, "");
    if (!name) return;
    names.push(name.includes(" ") ? `"${name}"` : name);
  };
  for (const rawPart of splitFontList(fontFamily)) {
    const part = rawPart.trim();
    if (!part) continue;
    if (/^var\s*\(/i.test(part)) {
      const resolved = resolveCssVarFontValue(part);
      if (resolved) for (const sub of splitFontList(resolved)) pushName(sub);
      continue;
    }
    pushName(part);
  }
  if (names.length === 0) return "sans-serif";
  return [...new Set(names)].join(", ");
}

export function fontFamilyLabel(value: string, catalog?: FontFamilyOption[]): string {
  const list = catalog ?? flattenFontCatalog(buildFontCatalog());
  const hit = list.find((f) => f.value === value);
  if (hit) return hit.label;
  return primaryFontName(value);
}

export function matchFontOption(
  value: string,
  catalog?: FontFamilyOption[],
): FontFamilyOption | null {
  const list = catalog ?? flattenFontCatalog(buildFontCatalog());
  const exact = list.find((f) => f.value === value);
  if (exact) return exact;
  const primary = primaryFontName(value).toLowerCase();
  return list.find((f) => f.primary.toLowerCase() === primary) ?? null;
}

/** Legacy export for callers still importing TEXT_FONT_FAMILIES. */
export const TEXT_FONT_FAMILIES = SYSTEM_FONT_OPTIONS.map((f) => ({
  label: f.label,
  value: f.value,
}));
