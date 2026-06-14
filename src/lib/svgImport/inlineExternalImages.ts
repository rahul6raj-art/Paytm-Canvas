import type { EditorAsset } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Inline remote image hrefs as data URLs when fetch succeeds (browser import only). */
export async function inlineExternalSvgImages(
  nodes: Record<string, EditorNode>,
  assets: Record<string, EditorAsset>,
): Promise<Record<string, EditorAsset>> {
  if (typeof fetch === "undefined") return assets;

  const out = { ...assets };
  const tasks: Promise<void>[] = [];

  for (const node of Object.values(nodes)) {
    if (node.type !== "image") continue;
    const assetId = node.assetId;
    if (!assetId) continue;
    const asset = out[assetId];
    if (!asset) continue;
    const href = asset.dataUrl;
    if (!href || href.startsWith("data:") || !/^https?:\/\//i.test(href)) continue;

    tasks.push(
      (async () => {
        try {
          const res = await fetch(href);
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl = await fileToDataUrl(blob);
          out[assetId] = { ...asset, dataUrl, mimeType: blob.type || asset.mimeType };
          if (node.imageSrc === href) {
            nodes[node.id] = { ...node, imageSrc: dataUrl };
          }
        } catch {
          // keep original href
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return out;
}
