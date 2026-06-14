import { validateFontImportFile } from "@/lib/editorFontAssets";
import { ensureFontFamilyLoaded } from "@/lib/fonts/fontLoader";
import { uploadedFontOptionsFromAssets } from "@/lib/fonts/uploadedFonts";
import { useEditorStore } from "@/stores/useEditorStore";

function uniqueFontFiles(files: Iterable<File>): File[] {
  const out: File[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const err = validateFontImportFile(f);
    if (err) continue;
    const key = `${f.name}:${f.size}:${f.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** Collect TTF/OTF files from a drag-and-drop payload. */
export function collectFontFilesFromDataTransfer(dt: DataTransfer): File[] {
  const collected: File[] = [];
  for (const f of dt.files) collected.push(f);
  for (const item of dt.items) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) collected.push(f);
  }
  return uniqueFontFiles(collected);
}

/** True when the data transfer may contain importable font files. */
export function canAcceptCanvasFontDrop(dt: DataTransfer): boolean {
  if (![...dt.types].includes("Files")) return false;
  for (const f of dt.files) {
    if (validateFontImportFile(f) === null) return true;
  }
  for (const item of dt.items) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f && validateFontImportFile(f) === null) return true;
  }
  return false;
}

function fontFamilyValueForAsset(assetId: string): string | null {
  const { fontAssets } = useEditorStore.getState();
  const asset = fontAssets[assetId];
  if (!asset) return null;
  const opt = uploadedFontOptionsFromAssets({ [assetId]: asset })[0];
  return opt?.value ?? null;
}

export function applyFontFamilyToSelectedText(fontFamily: string): boolean {
  const store = useEditorStore.getState();
  const { selectedIds, nodes } = store;
  const textIds = selectedIds.filter((id) => {
    const n = nodes[id];
    return n?.type === "text" && !n.locked;
  });
  if (textIds.length === 0) return false;

  const patches = Object.fromEntries(textIds.map((id) => [id, { fontFamily }]));
  store.pushHistory();
  store.updateNodes(patches, { skipHistory: true });
  return true;
}

export type ImportDroppedFontsOptions = {
  /** When true (default), apply the last imported family to selected text nodes. */
  applyToSelection?: boolean;
};

/** Import dropped font files into the document. Returns count of fonts imported. */
export async function importDroppedFontFiles(
  files: File[],
  options?: ImportDroppedFontsOptions,
): Promise<number> {
  const applyToSelection = options?.applyToSelection !== false;
  let imported = 0;
  let lastFontFamily: string | null = null;

  for (const file of files) {
    const assetId = await useEditorStore.getState().importFontFile(file);
    if (!assetId) continue;
    imported++;
    lastFontFamily = fontFamilyValueForAsset(assetId);
  }

  if (imported === 0 || !lastFontFamily || !applyToSelection) return imported;

  const { fontAssets } = useEditorStore.getState();
  await ensureFontFamilyLoaded(lastFontFamily, fontAssets);
  applyFontFamilyToSelectedText(lastFontFamily);
  return imported;
}

/** Handle font file drop on the canvas or assets panel. */
export async function handleCanvasFontDrop(
  dt: DataTransfer,
  options?: ImportDroppedFontsOptions,
): Promise<boolean> {
  const files = collectFontFilesFromDataTransfer(dt);
  if (files.length === 0) return false;
  const imported = await importDroppedFontFiles(files, options);
  return imported > 0;
}
