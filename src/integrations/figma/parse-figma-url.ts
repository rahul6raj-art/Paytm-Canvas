import type { ParsedFigmaUrl } from "@/integrations/figma/types";

/** Parse figma.com design/file/proto URLs into file key and optional node id. */
export function parseFigmaUrl(raw: string): ParsedFigmaUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!u.hostname.endsWith("figma.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    const designIdx = parts.findIndex((p) => ["design", "file", "proto", "board"].includes(p));
    if (designIdx < 0 || !parts[designIdx + 1]) return null;

    const fileKey = parts[designIdx + 1]!;
    let nodeId: string | undefined;
    const nodeParam = u.searchParams.get("node-id");
    if (nodeParam) {
      nodeId = decodeURIComponent(nodeParam).replace(/-/g, ":");
    }
    return { fileKey, nodeId };
  } catch {
    return null;
  }
}

/** Raw file key (alphanumeric) without URL. */
export function parseFigmaFileKey(raw: string): string | null {
  const key = raw.trim();
  if (!/^[a-zA-Z0-9]{8,64}$/.test(key)) return null;
  return key;
}

export function isFigmaDesignUrl(raw: string): boolean {
  return parseFigmaUrl(raw) !== null;
}
