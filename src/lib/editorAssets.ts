import type { EditorAsset } from "@/lib/documentPersistence";

export const IMAGE_IMPORT_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export const MAX_IMAGE_IMPORT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export function validateImageImportFile(file: File): string | null {
  if (!file.size) return "Empty file.";
  if (file.size > MAX_IMAGE_IMPORT_BYTES) {
    return `Image is too large (max ${Math.round(MAX_IMAGE_IMPORT_BYTES / (1024 * 1024))}MB).`;
  }
  const type = (file.type || "").toLowerCase();
  if (!ALLOWED_MIMES.has(type)) {
    return "Unsupported image type. Use PNG, JPEG, WebP, or SVG.";
  }
  return null;
}

function newAssetId(): string {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readNaturalSize(dataUrl: string): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w > 0 && h > 0) resolve({ width: w, height: h });
      else resolve(undefined);
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

/**
 * Reads a raster or SVG file as a **data URL** only (never returns raw SVG markup for DOM injection).
 */
export async function buildEditorAssetFromFile(file: File): Promise<EditorAsset> {
  const err = validateImageImportFile(file);
  if (err) throw new Error(err);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const r = fr.result;
      if (typeof r !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      resolve(r);
    };
    fr.onerror = () => reject(new Error("Could not read file."));
    fr.readAsDataURL(file);
  });

  const dims = await readNaturalSize(dataUrl);

  return {
    id: newAssetId(),
    name: file.name || "Image",
    mimeType: (file.type || "application/octet-stream").toLowerCase(),
    dataUrl,
    createdAt: new Date().toISOString(),
    width: dims?.width,
    height: dims?.height,
  };
}
