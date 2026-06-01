export interface ParsedFigmaUrl {
  fileKey: string;
  /** Figma node id e.g. `123:456` */
  nodeId?: string;
}

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
