import { localFontsSupported } from "./localFonts";

export type InstalledFontFace = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
};

let installedFacesCache: InstalledFontFace[] | null = null;

export function resetInstalledFontFaceCache(): void {
  installedFacesCache = null;
}

/** Score how well a face style matches a target weight (higher = better). */
export function styleScoreForWeight(style: string, weight: number): number {
  const s = style.trim().toLowerCase();
  const wantBold = weight >= 600;

  if (wantBold) {
    if (s.includes("bold") && !s.includes("semibold")) return 100;
    if (s.includes("semibold") || s.includes("demi")) return 90;
    if (s.includes("black") || s.includes("heavy") || s.includes("extra bold")) return 85;
    if (s.includes("medium")) return 55;
    if (s === "regular" || s === "normal") return 20;
    if (s.includes("light")) return 10;
    return 40;
  }

  if (s === "regular" || s === "normal") return 100;
  if (s.includes("medium") || s.includes("book")) return 90;
  if (s.includes("light") || s.includes("thin")) return 75;
  if (s.includes("semibold") || s.includes("demi")) return 45;
  if (s.includes("bold")) return 15;
  return 40;
}

/** Pick the best installed face for a family + weight. */
export function pickInstalledFontFace(
  faces: InstalledFontFace[],
  family: string,
  weight: number,
): InstalledFontFace | null {
  const target = family.trim().toLowerCase();
  const matches = faces.filter((f) => f.family.trim().toLowerCase() === target);
  if (matches.length === 0) return null;

  let best = matches[0]!;
  let bestScore = styleScoreForWeight(best.style, weight);
  for (const face of matches.slice(1)) {
    const score = styleScoreForWeight(face.style, weight);
    if (score > bestScore) {
      best = face;
      bestScore = score;
    }
  }
  return best;
}

async function queryInstalledFontFaces(): Promise<InstalledFontFace[]> {
  if (!localFontsSupported()) return [];
  if (installedFacesCache) return installedFacesCache;
  const faces = (await window.queryLocalFonts!()) as InstalledFontFace[];
  installedFacesCache = faces;
  return faces;
}

/** Read SFNT bytes for an OS-installed font family + weight. */
export async function fetchInstalledFontBinary(
  family: string,
  weight: number,
): Promise<Uint8Array> {
  const faces = await queryInstalledFontFaces();
  const face = pickInstalledFontFace(faces, family, weight);
  if (!face) {
    throw new Error(`Installed font not found: ${family}`);
  }
  const blob = await face.blob();
  return new Uint8Array(await blob.arrayBuffer());
}
