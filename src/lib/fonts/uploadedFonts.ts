import type { EditorFontAsset } from "@/lib/documentPersistence";
import type { FontFamilyOption } from "./fontCatalog";

function cssFamilyForUploaded(family: string): string {
  const safe = family.replace(/"/g, '\\"');
  return `"${safe}", system-ui, sans-serif`;
}

export function uploadedFontOptionsFromAssets(
  fontAssets: Record<string, EditorFontAsset>,
): FontFamilyOption[] {
  const byFamily = new Map<string, FontFamilyOption>();

  for (const asset of Object.values(fontAssets)) {
    const family = asset.family.trim();
    if (!family) continue;
    const key = family.toLowerCase();
    if (byFamily.has(key)) continue;
    byFamily.set(key, {
      id: `uploaded-${key.replace(/[^a-z0-9]+/g, "-")}`,
      label: family,
      value: cssFamilyForUploaded(family),
      source: "uploaded",
      primary: family,
    });
  }

  return [...byFamily.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Pick the best uploaded asset for a target weight. */
export function findUploadedFontAsset(
  fontAssets: Record<string, EditorFontAsset>,
  family: string,
  weight: number,
): EditorFontAsset | undefined {
  const target = family.trim().toLowerCase();
  const matches = Object.values(fontAssets).filter(
    (a) => a.family.trim().toLowerCase() === target,
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  let best = matches[0]!;
  let bestDelta = Math.abs(best.weight - weight);
  for (const asset of matches.slice(1)) {
    const delta = Math.abs(asset.weight - weight);
    if (delta < bestDelta) {
      best = asset;
      bestDelta = delta;
    }
  }
  return best;
}
