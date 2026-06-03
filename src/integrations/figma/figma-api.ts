import { figmaFetch } from "@/integrations/figma/figma-fetch";
import { getFigmaApiBaseUrl } from "@/integrations/figma/figma-server-env";
import { parseFigmaFileKey, parseFigmaUrl } from "@/integrations/figma/parse-figma-url";
import type {
  FigmaApiNode,
  FigmaFileResponse,
  FigmaImagesResponse,
  FigmaNodesResponse,
} from "@/integrations/figma/types";

export interface FigmaMeUser {
  id: string;
  email: string;
  handle: string;
  img_url?: string;
}

interface FigmaMeResponse {
  id: string;
  email: string;
  handle: string;
  img_url?: string;
}

export class FigmaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FigmaApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function figmaGetOnce<T>(path: string, token: string): Promise<T> {
  const base = getFigmaApiBaseUrl().replace(/\/$/, "");
  const res = await figmaFetch(`${base}${path}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { err?: string; message?: string };
      detail = body.err ?? body.message ?? detail;
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      const lower = detail.toLowerCase();
      if (lower.includes("invalid token")) {
        detail =
          "Your Figma access token is invalid or expired. Create a new token in Figma → Settings → Security, update FIGMA_ACCESS_TOKEN in .env.local (restart the dev server), or paste a new token in Import from Figma and click Verify & connect.";
      } else {
        detail = `Figma denied access (403). Ensure your token can open this file and the link is correct. ${detail}`;
      }
    }
    throw new FigmaApiError(detail || `Figma API error (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

async function figmaGet<T>(path: string, token: string, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await figmaGetOnce<T>(path, token);
    } catch (e) {
      last = e;
      const retryable =
        e instanceof FigmaApiError &&
        (e.status === 429 || (e.status != null && e.status >= 500));
      if (!retryable || i === attempts - 1) throw e;
      const delay = e.status === 429 ? 2000 * (i + 1) : 600 * (i + 1);
      await sleep(delay);
    }
  }
  throw last;
}

/** GET /v1/me — validates token and returns the authenticated Figma user. */
export async function getFigmaMe(accessToken: string): Promise<FigmaMeUser> {
  const token = accessToken.trim();
  if (!token) throw new FigmaApiError("Figma access token is required.");
  const data = await figmaGet<FigmaMeResponse>("/me", token);
  if (!data.id || !data.email) {
    throw new FigmaApiError("Could not read your Figma account from this token.");
  }
  return {
    id: data.id,
    email: data.email,
    handle: data.handle || data.email.split("@")[0] || "Figma user",
    img_url: data.img_url,
  };
}

export interface FigmaFetchResult {
  fileKey: string;
  fileName: string;
  root: FigmaApiNode;
  components: Record<string, { key: string; name: string }>;
}

type FigmaNodeEntry = NonNullable<NonNullable<FigmaNodesResponse["nodes"][string]>>;

function canonicalFigmaNodeId(nodeId: string): string {
  return nodeId.trim().replace(/-/g, ":");
}

/** Figma may key nodes by `36:2738` or `36-2738` depending on the request. */
function resolveFigmaNodeEntry(
  nodes: FigmaNodesResponse["nodes"],
  nodeId: string,
): FigmaNodeEntry | null {
  const canonical = canonicalFigmaNodeId(nodeId);
  const direct = nodes[canonical] ?? nodes[nodeId.trim()];
  if (direct) return direct;
  for (const [key, entry] of Object.entries(nodes)) {
    if (entry && canonicalFigmaNodeId(key) === canonical) return entry;
  }
  return null;
}

/** GET /v1/files/{fileKey} or /v1/files/{fileKey}/nodes */
export async function getFile(opts: {
  accessToken: string;
  url?: string;
  fileKey?: string;
  nodeId?: string;
}): Promise<FigmaFetchResult> {
  const token = opts.accessToken.trim();
  if (!token) throw new FigmaApiError("Figma access token is required.");

  let fileKey = opts.fileKey?.trim();
  let nodeId = opts.nodeId?.trim();

  if (opts.url?.trim()) {
    const parsed = parseFigmaUrl(opts.url);
    if (!parsed) throw new FigmaApiError("Invalid Figma design URL.");
    fileKey = parsed.fileKey;
    nodeId = nodeId || parsed.nodeId;
  }

  if (!fileKey) throw new FigmaApiError("Figma file key or URL is required.");

  const geometry = "geometry=paths";

  if (nodeId) {
    const canonicalId = canonicalFigmaNodeId(nodeId);
    const data = await figmaGet<FigmaNodesResponse>(
      `/files/${fileKey}/nodes?ids=${encodeURIComponent(canonicalId)}&${geometry}`,
      token,
    );
    const entry = resolveFigmaNodeEntry(data.nodes ?? {}, canonicalId);
    if (!entry?.document) {
      throw new FigmaApiError(
        `Frame "${canonicalId}" was not found. In Figma, select the frame you want and press ⌘L (Copy link), then paste that link here.`,
      );
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

function pickDefaultRoot(doc: FigmaApiNode): FigmaApiNode | null {
  if (doc.type !== "DOCUMENT" && doc.type !== "CANVAS") {
    return doc;
  }
  const pages = doc.children ?? [];
  for (const page of pages) {
    if (page.type === "CANVAS" && (page.children?.length ?? 0) > 0) {
      return page;
    }
    if (page.type === "FRAME" || page.type === "COMPONENT" || page.type === "INSTANCE") {
      return page;
    }
  }
  return pages[0] ?? null;
}

/** GET /v1/images/{fileKey} */
export async function getFigmaImageUrls(
  fileKey: string,
  imageRefs: string[],
  token: string,
): Promise<Record<string, string>> {
  if (imageRefs.length === 0) return {};
  const unique = [...new Set(imageRefs)];
  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const ids = chunk.map(encodeURIComponent).join(",");
    const data = await figmaGet<FigmaImagesResponse>(`/files/${fileKey}/images?ids=${ids}`, token);
    const images = data.images ?? {};
    for (const [ref, url] of Object.entries(images)) {
      if (url) out[ref] = url;
    }
  }
  return out;
}

export function resolveFigmaFileKey(input: { url?: string; fileKey?: string }): {
  fileKey: string;
  nodeId?: string;
} {
  if (input.url?.trim()) {
    const parsed = parseFigmaUrl(input.url);
    if (!parsed) throw new FigmaApiError("Invalid Figma design URL.");
    return { fileKey: parsed.fileKey, nodeId: parsed.nodeId };
  }
  const key = input.fileKey?.trim();
  if (!key) throw new FigmaApiError("Figma file key or URL is required.");
  const bare = parseFigmaFileKey(key);
  if (bare) return { fileKey: bare };
  throw new FigmaApiError("Invalid Figma file key.");
}
