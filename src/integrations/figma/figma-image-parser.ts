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

const IMAGE_EMBED_CONCURRENCY = 8;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;

async function fetchImageAsDataUrl(
  url: string,
  maxBytes: number,
): Promise<string | null> {
  const res = await Promise.race([
    figmaFetch(url),
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error("image fetch timeout")), IMAGE_FETCH_TIMEOUT_MS);
    }),
  ]);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) return null;
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${b64}`;
}

/** Server-side: embed remote Figma CDN URLs as data URLs when small enough. */
export async function embedFigmaImageUrls(
  urlByRef: Record<string, string>,
  maxBytes = 4 * 1024 * 1024,
): Promise<Record<string, string>> {
  const entries = Object.entries(urlByRef);
  const out: Record<string, string> = { ...urlByRef };
  let index = 0;

  async function worker(): Promise<void> {
    while (index < entries.length) {
      const i = index++;
      const [ref, url] = entries[i]!;
      if (!url.startsWith("http")) continue;
      try {
        const dataUrl = await fetchImageAsDataUrl(url, maxBytes);
        out[ref] = dataUrl ?? url;
      } catch {
        out[ref] = url;
      }
    }
  }

  const workers = Math.min(IMAGE_EMBED_CONCURRENCY, Math.max(1, entries.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}
