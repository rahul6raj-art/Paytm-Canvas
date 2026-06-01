import type {
  FigmaFileResponse,
  FigmaImagesResponse,
  FigmaNodesResponse,
} from "@/lib/figmaApi/figmaApiTypes";
import { parseFigmaUrl } from "@/lib/figmaApi/parseFigmaUrl";

const FIGMA_API = "https://api.figma.com/v1";

export class FigmaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FigmaApiError";
  }
}

async function figmaGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { err?: string; message?: string };
      detail = body.err ?? body.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new FigmaApiError(detail || `Figma API error (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface FigmaFetchResult {
  fileKey: string;
  fileName: string;
  root: import("@/lib/figmaApi/figmaApiTypes").FigmaApiNode;
  components: Record<string, { key: string; name: string }>;
}

export async function fetchFigmaForImport(opts: {
  accessToken: string;
  url?: string;
  fileKey?: string;
  nodeId?: string;
}): Promise<FigmaFetchResult> {
  const token = opts.accessToken.trim();
  if (!token) throw new FigmaApiError("Figma access token is required.");

  let fileKey = opts.fileKey;
  let nodeId = opts.nodeId;
  if (opts.url?.trim()) {
    const parsed = parseFigmaUrl(opts.url);
    if (!parsed) throw new FigmaApiError("Invalid Figma design URL.");
    fileKey = parsed.fileKey;
    nodeId = nodeId ?? parsed.nodeId;
  }
  if (!fileKey) throw new FigmaApiError("Figma file key or URL is required.");

  const geometry = "geometry=paths";

  if (nodeId) {
    const encoded = encodeURIComponent(nodeId);
    const data = await figmaGet<FigmaNodesResponse>(
      `/files/${fileKey}/nodes?ids=${encoded}&${geometry}`,
      token,
    );
    const entry = data.nodes[nodeId];
    if (!entry?.document) {
      throw new FigmaApiError("Frame not found in Figma file. Check the link and node id.");
    }
    return {
      fileKey,
      fileName: data.name ?? "Imported Figma",
      root: entry.document,
      components: entry.components ?? {},
    };
  }

  const file = await figmaGet<FigmaFileResponse>(`/files/${fileKey}?${geometry}`, token);
  const root = pickDefaultRoot(file.document);
  if (!root) throw new FigmaApiError("No importable content found in this Figma file.");
  return {
    fileKey,
    fileName: file.name ?? "Imported Figma",
    root,
    components: file.components ?? {},
  };
}

function pickDefaultRoot(
  doc: import("@/lib/figmaApi/figmaApiTypes").FigmaApiNode,
): import("@/lib/figmaApi/figmaApiTypes").FigmaApiNode | null {
  if (doc.type !== "DOCUMENT" && doc.type !== "CANVAS") {
    return doc;
  }
  const pages = doc.children ?? [];
  for (const page of pages) {
    if (page.type === "CANVAS" && page.children?.length) {
      const frame = page.children.find((c) =>
        ["FRAME", "COMPONENT", "INSTANCE", "GROUP", "SECTION"].includes(c.type),
      );
      if (frame) return frame;
      return page.children[0]!;
    }
    if (page.type === "FRAME" || page.type === "COMPONENT" || page.type === "INSTANCE") {
      return page;
    }
  }
  return pages[0] ?? null;
}

export async function fetchFigmaImageUrls(
  fileKey: string,
  imageRefs: string[],
  token: string,
): Promise<Record<string, string>> {
  if (imageRefs.length === 0) return {};
  const unique = [...new Set(imageRefs)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 40) {
    chunks.push(unique.slice(i, i + 40));
  }
  const out: Record<string, string> = {};
  for (const chunk of chunks) {
    const ids = chunk.map(encodeURIComponent).join(",");
    const data = await figmaGet<FigmaImagesResponse>(`/files/${fileKey}/images?ids=${ids}`, token);
    for (const [ref, url] of Object.entries(data.images)) {
      if (url) out[ref] = url;
    }
  }
  return out;
}
