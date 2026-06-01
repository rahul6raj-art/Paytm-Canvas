import type { FontFamilyOption } from "./fontCatalog";

type LocalFontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
};

function cssFamilyForInstalled(family: string): string {
  const safe = family.replace(/"/g, '\\"');
  return `"${safe}", system-ui, sans-serif`;
}

export function localFontsSupported(): boolean {
  return typeof window !== "undefined" && typeof window.queryLocalFonts === "function";
}

/** Enumerate fonts installed on the user's OS (Chrome/Edge; permission prompt). */
export async function queryInstalledFontOptions(): Promise<FontFamilyOption[]> {
  if (!localFontsSupported()) return [];

  try {
    const data = (await window.queryLocalFonts!()) as LocalFontData[];
    const byFamily = new Map<string, FontFamilyOption>();

    for (const entry of data) {
      const family = entry.family?.trim();
      if (!family) continue;
      const key = family.toLowerCase();
      if (byFamily.has(key)) continue;
      byFamily.set(key, {
        id: `local-${key.replace(/[^a-z0-9]+/g, "-")}`,
        label: family,
        value: cssFamilyForInstalled(family),
        source: "installed",
        primary: family,
      });
    }

    return [...byFamily.values()].sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}
