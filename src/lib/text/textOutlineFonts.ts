import opentype from "opentype.js";
import { primaryFontName } from "@/lib/fonts/fontCatalog";
import type { EditorFontAsset } from "@/lib/documentPersistence";
import { resolveTextTypo } from "@/lib/textTypography";
import type { EditorNode } from "@/stores/useEditorStore";

const fontCache = new Map<string, Promise<opentype.Font>>();

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** OpenType face weight for the embedded/uploaded file used during outline. */
export function outlineFaceWeight(fontWeight: number): number {
  return fontWeight >= 600 ? 700 : 400;
}

/** Map a text node to an embedded engine font file (fallback when no upload match). */
export function embeddedFontFileForTextNode(node: EditorNode): string {
  const typo = resolveTextTypo(node);
  const primary = primaryFontName(typo.fontFamily).toLowerCase();
  const bold = outlineFaceWeight(node.fontWeight ?? 500) >= 600;
  if (primary.includes("arabic")) return "NotoSansArabic-Regular.ttf";
  if (primary.includes("devanagari")) return "NotoSansDevanagari-Regular.ttf";
  if (primary.includes("bengali")) return "NotoSansBengali-Regular.ttf";
  if (primary.includes("tamil")) return "NotoSansTamil-Regular.ttf";
  if (primary.includes("hebrew")) return "NotoSansHebrew-Regular.ttf";
  if (primary.includes("roboto")) return bold ? "Roboto-Bold.ttf" : "Roboto-Regular.ttf";
  return bold ? "Inter-Bold.ttf" : "Inter-Regular.ttf";
}

async function loadEmbeddedFont(fileName: string): Promise<opentype.Font> {
  const res = await fetch(`/api/fonts/${encodeURIComponent(fileName)}`);
  if (!res.ok) throw new Error(`Font not found: ${fileName}`);
  const buffer = await res.arrayBuffer();
  return opentype.parse(buffer);
}

async function loadEmbeddedFontWithFallback(
  fileName: string,
): Promise<opentype.Font> {
  try {
    return await loadEmbeddedFont(fileName);
  } catch (primaryError) {
    const regular = fileName.replace("-Bold.", "-Regular.");
    if (regular !== fileName) {
      try {
        return await loadEmbeddedFont(regular);
      } catch {
        // fall through to primary error
      }
    }
    throw primaryError;
  }
}

async function loadUploadedFont(asset: EditorFontAsset): Promise<opentype.Font> {
  return opentype.parse(dataUrlToArrayBuffer(asset.dataUrl));
}

/** Resolve and parse the closest available font face for outlining text. */
export async function loadOpentypeFontForTextNode(
  node: EditorNode,
  fontAssets: Record<string, EditorFontAsset>,
): Promise<opentype.Font> {
  const typo = resolveTextTypo(node);
  const primary = primaryFontName(typo.fontFamily);
  const bold = outlineFaceWeight(node.fontWeight ?? 500) >= 600;
  const cacheKey = `${primary.toLowerCase()}|${bold ? "700" : "400"}|upload:${Object.keys(fontAssets).length}`;

  const cached = fontCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const uploaded = Object.values(fontAssets).find(
        (asset) => asset.family.trim().toLowerCase() === primary.toLowerCase(),
      );
      if (uploaded) return loadUploadedFont(uploaded);
      return loadEmbeddedFontWithFallback(embeddedFontFileForTextNode(node));
    } catch (error) {
      fontCache.delete(cacheKey);
      throw error;
    }
  })();

  fontCache.set(cacheKey, promise);
  return promise;
}
