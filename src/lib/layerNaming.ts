const NUMBERED_LAYER_RE = /^(.+?)\s+(\d+)$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse "Rectangle 2" → { base: "Rectangle", number: 2 }; bare names use number 0. */
export function parseNumberedLayerName(name: string): { base: string; number: number } {
  const trimmed = name.trim();
  const match = NUMBERED_LAYER_RE.exec(trimmed);
  if (match) return { base: match[1]!.trim(), number: Number(match[2]) };
  return { base: trimmed, number: 0 };
}

/** Highest numeric suffix used for a layer base name in the document. */
export function maxNumberedLayerIndex(
  nodes: Record<string, { name: string }>,
  baseLabel: string,
): number {
  const base = baseLabel.trim();
  if (!base) return 0;
  const re = new RegExp(`^${escapeRegExp(base)}(?:\\s+(\\d+))?$`, "i");
  let max = 0;
  for (const node of Object.values(nodes)) {
    const match = re.exec(node.name.trim());
    if (!match) continue;
    const index = match[1] ? Number(match[1]) : 1;
    max = Math.max(max, index);
  }
  return max;
}

/** Figma-style name for a new layer: "Rectangle 1", "Ellipse 2", … */
export function nextNumberedLayerName(
  nodes: Record<string, { name: string }>,
  baseLabel: string,
): string {
  const base = baseLabel.trim();
  return `${base} ${maxNumberedLayerIndex(nodes, base) + 1}`;
}

/** Name for a duplicate/copy: same base as source, next free number (not "… copy"). */
export function nextDuplicatedLayerName(
  nodes: Record<string, { name: string }>,
  sourceName: string,
): string {
  const { base } = parseNumberedLayerName(sourceName);
  return nextNumberedLayerName(nodes, base);
}

const TEXT_LAYER_NAME_MAX = 120;

/** Layer name mirrors visible text (first line), like Figma. */
export function layerNameFromTextContent(content: string | undefined | null): string {
  const firstLine = (content ?? "").split(/\r?\n/)[0]!.replace(/\s+/g, " ").trim();
  if (!firstLine) return "Text";
  const label = firstLine;
  if (label.length <= TEXT_LAYER_NAME_MAX) return label;
  return `${label.slice(0, TEXT_LAYER_NAME_MAX - 1)}…`;
}

/** Text duplicates keep the same label as the source (content is cloned unchanged). */
export function duplicatedTextLayerName(content: string | undefined | null): string {
  return layerNameFromTextContent(content);
}
