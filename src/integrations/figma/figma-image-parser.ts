import { figmaFetch } from "@/integrations/figma/figma-fetch";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import type { FigmaApiNode } from "@/integrations/figma/types";
import { imageRefFromPaints } from "@/integrations/figma/figma-style-parser";

export function collectFigmaImageRefs(node: FigmaApiNode, refs: Set<string>): void {
  const ref = imageRefFromPaints(node.fills);
  if (ref) refs.add(ref);
  for (const c of node.children ?? []) collectFigmaImageRefs(c, refs);
}

export function applyFigmaImageUrls(
  nodes: Record<string, EditorNode>,
  assets: Record<string, EditorAsset>,
  urlByRef: Record<string, string>,
): void {
  for (const node of Object.values(nodes)) {
    if (node.type !== "image" || !node.assetId?.startsWith("pending-")) continue;
    const ref = node.assetId.slice("pending-".length);
    const url = urlByRef[ref];
    if (!url) continue;
    const assetId = `figma-img-${ref.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
    assets[assetId] = {
      id: assetId,
      name: node.name || "Image",
      mimeType: "image/png",
      dataUrl: url,
      createdAt: new Date().toISOString(),
    };
    node.assetId = assetId;
    node.imageSrc = url;
  }
}

/** Server-side: embed remote Figma CDN URLs as data URLs when small enough. */
export async function embedFigmaImageUrls(
  urlByRef: Record<string, string>,
  maxBytes = 4 * 1024 * 1024,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [ref, url] of Object.entries(urlByRef)) {
    if (!url.startsWith("http")) {
      out[ref] = url;
      continue;
    }
    try {
      const res = await figmaFetch(url);
      if (!res.ok) {
        out[ref] = url;
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes) {
        out[ref] = url;
        continue;
      }
      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
      const b64 = Buffer.from(buf).toString("base64");
      out[ref] = `data:${mime};base64,${b64}`;
    } catch {
      out[ref] = url;
    }
  }
  return out;
}
