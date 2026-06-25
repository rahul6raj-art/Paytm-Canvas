import { validateImageImportFile } from "@/lib/editorAssets";

const IMAGE_URL_RE = /\.(png|jpe?g|webp|svg)(\?.*)?$/i;

export function isLikelyImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("data:image/")) return true;
  if (IMAGE_URL_RE.test(u)) return true;
  return false;
}

export function extractImgSrcFromHtml(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? null;
}

function uniqueImageFiles(files: Iterable<File>): File[] {
  const out: File[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const err = validateImageImportFile(f);
    if (err) continue;
    const key = `${f.name}:${f.size}:${f.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function imageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const collected: File[] = [];
  for (const f of data.files) collected.push(f);
  for (const item of data.items) {
    if (item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const f = item.getAsFile();
    if (f) collected.push(f);
  }
  return uniqueImageFiles(collected);
}

export async function imageFileFromUrl(url: string): Promise<File | null> {
  const trimmed = url.trim();
  if (!trimmed || !isLikelyImageUrl(trimmed)) return null;
  try {
    const res = await fetch(trimmed);
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = (blob.type || "").toLowerCase();
    if (!type.startsWith("image/")) return null;
    const err = validateImageImportFile(
      new File([blob], "image", { type }),
    );
    if (err) return null;
    const ext = type.split("/")[1]?.replace("+xml", "") ?? "png";
    const name = trimmed.startsWith("data:")
      ? `image.${ext}`
      : decodeURIComponent(trimmed.split("/").pop()?.split("?")[0] ?? `image.${ext}`);
    return new File([blob], name, { type });
  } catch {
    return null;
  }
}

/** Collect raster/SVG files from a drag-and-drop (desktop, browser tab, or image URL). */
export async function collectImageFilesFromDataTransfer(
  dt: DataTransfer,
): Promise<File[]> {
  const collected: File[] = [];
  for (const f of dt.files) collected.push(f);
  for (const item of dt.items) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) collected.push(f);
  }
  let files = uniqueImageFiles(collected);
  if (files.length > 0) return files;

  const uri =
    dt
      .getData("text/uri-list")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#")) ?? "";
  if (uri) {
    const fromUri = await imageFileFromUrl(uri);
    if (fromUri) return [fromUri];
  }

  const html = dt.getData("text/html");
  const src = extractImgSrcFromHtml(html);
  if (src) {
    const fromHtml = await imageFileFromUrl(src);
    if (fromHtml) return [fromHtml];
  }

  return [];
}

/** True when the data transfer may contain placeable image content. */
export function canAcceptCanvasImageDrop(dt: DataTransfer): boolean {
  if ([...dt.types].includes("application/x-pc-component")) return true;
  if ([...dt.types].includes("application/x-pc-asset")) return true;

  if ([...dt.types].includes("Files")) {
    for (const f of dt.files) {
      if (validateImageImportFile(f) === null) return true;
    }
    for (const item of dt.items) {
      if (item.kind === "file" && item.type.startsWith("image/")) return true;
    }
  }

  if ([...dt.types].includes("text/uri-list")) return true;
  if ([...dt.types].includes("text/html")) return true;
  return false;
}

/** True when a component is being dragged from the assets/components panel. */
export function isCanvasComponentDrag(dt: DataTransfer): boolean {
  return [...dt.types].includes("application/x-pc-component");
}

export function readCanvasComponentDragId(dt: DataTransfer): string | null {
  const direct = dt.getData("application/x-pc-component").trim();
  if (direct) return direct;
  if (isCanvasComponentDrag(dt)) {
    const fallback = dt.getData("text/plain").trim();
    if (fallback) return fallback;
  }
  return null;
}

export function canAcceptCanvasComponentDrop(
  dt: DataTransfer,
  placingComponentMasterId?: string | null,
): boolean {
  if (placingComponentMasterId) return true;
  return isCanvasComponentDrag(dt);
}

/** Resolve component master key on canvas drop (drag payload, then active placement). */
export function resolveCanvasComponentDropKey(
  dt: DataTransfer,
  placingComponentMasterId?: string | null,
): string | null {
  const fromDrag = readCanvasComponentDragId(dt);
  if (fromDrag) return fromDrag;
  const placing = placingComponentMasterId?.trim();
  return placing || null;
}
