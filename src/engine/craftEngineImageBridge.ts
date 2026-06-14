import type { EditorAsset, EditorNode } from "@/stores/useEditorStore";
import type { CraftEngineInstance } from "@/engine/craftEngineTypes";

const uploaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

function decodeDataUrlToRgba(
  dataUrl: string,
): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = Math.max(1, img.naturalWidth || img.width);
      const height = Math.max(1, img.naturalHeight || img.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2d context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      resolve({ width, height, rgba: new Uint8Array(imageData.data) });
    };
    img.onerror = () => reject(new Error("failed to decode image"));
    img.src = dataUrl;
  });
}

export function resetCraftEngineImageUploads(): void {
  uploaded.clear();
  pending.clear();
}

export async function syncCraftEngineImageAssets(
  engine: CraftEngineInstance,
  nodes: Record<string, EditorNode>,
  assets: Record<string, EditorAsset> | undefined,
): Promise<void> {
  if (!assets) return;

  const referenced = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.type === "image" && node.assetId) referenced.add(node.assetId);
  }

  const tasks: Promise<void>[] = [];
  for (const assetId of referenced) {
    if (uploaded.has(assetId)) continue;
    const existing = pending.get(assetId);
    if (existing) {
      tasks.push(existing);
      continue;
    }
    const asset = assets[assetId];
    if (!asset?.dataUrl) continue;

    const task = decodeDataUrlToRgba(asset.dataUrl)
      .then(({ width, height, rgba }) => {
        engine.registerImageAsset(assetId, width, height, rgba);
        uploaded.add(assetId);
      })
      .finally(() => {
        pending.delete(assetId);
      });
    pending.set(assetId, task);
    tasks.push(task);
  }

  await Promise.all(tasks);
}
