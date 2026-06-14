import { useEditorStore } from "@/stores/useEditorStore";
import { clientToWorld } from "@/lib/canvasCoordinates";
import {
  collectImageFilesFromDataTransfer,
  imageFilesFromClipboard,
} from "@/lib/canvasImageImport";
import { getLastCanvasWorldPoint } from "@/lib/canvasPointerMemory";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export function resolveCanvasImageWorldPoint(
  clientX: number | undefined,
  clientY: number | undefined,
  toWorld: ClientToWorldFn,
  viewportEl: HTMLElement | null,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  if (clientX != null && clientY != null) return toWorld(clientX, clientY);
  const last = getLastCanvasWorldPoint();
  if (last) return last;
  if (viewportEl && viewportEl.clientWidth > 0 && viewportEl.clientHeight > 0) {
    const rect = viewportEl.getBoundingClientRect();
    return clientToWorld(
      rect.left + viewportEl.clientWidth / 2,
      rect.top + viewportEl.clientHeight / 2,
      viewportEl,
      { pan, zoom },
    );
  }
  return { x: 300, y: 300 };
}

export async function placeImageFilesAtWorld(
  files: File[],
  world: { x: number; y: number },
): Promise<number> {
  if (files.length === 0) return 0;
  return useEditorStore.getState().placeImageFilesOnCanvas(files, world.x, world.y);
}

/** Drop a file onto the canvas at a world point (SVG layers or raster images). */
export async function dropFile(
  file: File,
  worldX: number,
  worldY: number,
): Promise<number> {
  return placeImageFilesAtWorld([file], { x: worldX, y: worldY });
}

export async function handleCanvasImageDrop(
  dt: DataTransfer,
  clientX: number,
  clientY: number,
  toWorld: ClientToWorldFn,
  viewportEl: HTMLElement | null,
  pan: { x: number; y: number },
  zoom: number,
): Promise<boolean> {
  const files = await collectImageFilesFromDataTransfer(dt);
  if (files.length === 0) return false;
  const world = resolveCanvasImageWorldPoint(clientX, clientY, toWorld, viewportEl, pan, zoom);
  const placed = await placeImageFilesAtWorld(files, world);
  return placed > 0;
}

/** Paste image from OS clipboard (screenshots, copied images). Returns true when handled. */
export async function pasteCanvasImageFromClipboard(
  clipboardData: DataTransfer | null,
  toWorld: ClientToWorldFn,
  viewportEl: HTMLElement | null,
  pan: { x: number; y: number },
  zoom: number,
  clientX?: number,
  clientY?: number,
): Promise<boolean> {
  let files = imageFilesFromClipboard(clipboardData);

  if (files.length === 0) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith("image/")) continue;
          const blob = await item.getType(type);
          const ext = type.split("/")[1]?.replace("+xml", "") ?? "png";
          files.push(new File([blob], `pasted.${ext}`, { type }));
        }
      }
      files = files.filter((f) => f.size > 0);
    } catch {
      /* Clipboard API blocked or unavailable */
    }
  }

  if (files.length === 0) return false;
  const world = resolveCanvasImageWorldPoint(clientX, clientY, toWorld, viewportEl, pan, zoom);
  const placed = await placeImageFilesAtWorld(files, world);
  return placed > 0;
}
