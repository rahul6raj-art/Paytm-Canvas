import type { EditorFontAsset } from "@/lib/documentPersistence";

export const FONT_IMPORT_ACCEPT =
  ".ttf,.otf,font/ttf,font/otf,application/font-sfnt,application/x-font-ttf,application/x-font-opentype";

export const MAX_FONT_IMPORT_BYTES = 2 * 1024 * 1024;

const ALLOWED_FONT_MIMES = new Set([
  "font/ttf",
  "font/otf",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-opentype",
  "application/octet-stream",
]);

function newFontAssetId(): string {
  return `font-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function inferFontWeightFromFileName(fileName: string): number {
  const lower = fileName.toLowerCase();
  if (/(bold|black|heavy|extrabold)/.test(lower)) return 700;
  if (/(semibold|demi)/.test(lower)) return 600;
  if (/medium/.test(lower)) return 500;
  if (/(light|thin)/.test(lower)) return 300;
  return 400;
}

/** Derive a CSS family label from the uploaded file name. */
export function familyNameFromFontFile(file: File): string {
  const stripped = file.name
    .replace(/\.(ttf|otf|woff2?)$/i, "")
    .replace(/[-_\s]+(regular|bold|light|medium|thin|black|heavy|semibold|extrabold)$/i, "")
    .trim();
  return stripped || "Uploaded Font";
}

export function validateFontImportFile(file: File): string | null {
  if (!file.size) return "Empty file.";
  if (file.size > MAX_FONT_IMPORT_BYTES) {
    return `Font is too large (max ${Math.round(MAX_FONT_IMPORT_BYTES / (1024 * 1024))}MB).`;
  }
  const lowerName = file.name.toLowerCase();
  const byExt = lowerName.endsWith(".ttf") || lowerName.endsWith(".otf");
  const type = (file.type || "").toLowerCase();
  if (!byExt && type && !ALLOWED_FONT_MIMES.has(type)) {
    return "Unsupported font type. Use TTF or OTF.";
  }
  return null;
}

export function fontAssetBytes(asset: EditorFontAsset): Uint8Array {
  const comma = asset.dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Invalid font data URL.");
  const b64 = asset.dataUrl.slice(comma + 1);
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function buildEditorFontAssetFromFile(file: File): Promise<EditorFontAsset> {
  const err = validateFontImportFile(file);
  if (err) throw new Error(err);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const r = fr.result;
      if (typeof r !== "string") {
        reject(new Error("Could not read font file."));
        return;
      }
      resolve(r);
    };
    fr.onerror = () => reject(new Error("Could not read font file."));
    fr.readAsDataURL(file);
  });

  const family = familyNameFromFontFile(file);
  const weight = inferFontWeightFromFileName(file.name);
  const ext = file.name.toLowerCase().endsWith(".otf") ? "font/otf" : "font/ttf";

  return {
    id: newFontAssetId(),
    family,
    weight,
    fileName: file.name,
    mimeType: (file.type || ext).toLowerCase(),
    dataUrl,
    createdAt: new Date().toISOString(),
  };
}
