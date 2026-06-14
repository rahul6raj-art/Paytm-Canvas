import type { APIRequestContext } from "playwright";
import type { DomSnapshotNode } from "@/lib/webImport/types";

const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;

/** Replace remote <img> src values with inlined data URLs (avoids CORS on the canvas). */
export async function inlineDomImageSources(
  root: DomSnapshotNode,
  request: APIRequestContext,
): Promise<DomSnapshotNode> {
  const cache = new Map<string, string>();

  const inlineSrc = async (src: string | undefined): Promise<string | undefined> => {
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
    if (cache.has(src)) return cache.get(src);
    try {
      const res = await request.get(src, { timeout: 12_000 });
      if (!res.ok()) return src;
      const buf = await res.body();
      if (buf.byteLength > MAX_INLINE_IMAGE_BYTES) return src;
      const mime = res.headers()["content-type"]?.split(";")[0]?.trim() || "image/png";
      const dataUrl = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
      cache.set(src, dataUrl);
      return dataUrl;
    } catch {
      return src;
    }
  };

  const walk = async (node: DomSnapshotNode): Promise<DomSnapshotNode> => {
    const children = await Promise.all(node.children.map(walk));
    let src = node.src;
    if (node.tagName.toLowerCase() === "img" && src) {
      src = await inlineSrc(src);
    }
    let backgroundImageSrc = node.backgroundImageSrc;
    if (backgroundImageSrc) {
      backgroundImageSrc = await inlineSrc(backgroundImageSrc);
    }
    return { ...node, src, backgroundImageSrc, children };
  };

  return walk(root);
}
