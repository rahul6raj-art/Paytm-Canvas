import { GOOGLE_FONTS, cssFamilyForGoogleFont } from "./googleFonts";
import { SYSTEM_FONT_OPTIONS } from "./systemFonts";

export type FontSource = "google" | "system" | "installed";

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

export function setInstalledFontOptions(fonts: FontFamilyOption[]): void {
  installedFontsCache = fonts;
  cachedCatalog = null;
}

export function buildFontCatalog(installed: FontFamilyOption[] = installedFontsCache): FontCatalogGroup[] {
  if (cachedCatalog && installed === installedFontsCache) return cachedCatalog;

  const installedSorted = [...installed].sort((a, b) => a.label.localeCompare(b.label));

  cachedCatalog = [
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

/** First family name in a CSS font-family stack. */
export function primaryFontName(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "").replace(/^var\([^)]+\),\s*/i, "").trim() || "sans-serif";
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
