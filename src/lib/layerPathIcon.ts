import { tessellateSvgPathD } from "@/lib/outlineStroke";
import { resolvePathOutlineD } from "@/lib/shapes/shapeToPath";
import type { EditorNode } from "@/stores/useEditorStore";

export type PathLayerIconSpec = {
  d: string;
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export function pathLayerOutlineD(node: EditorNode): string {
  if (node.type !== "path") return "";
  return resolvePathOutlineD(node);
}

function boundsFromPathD(d: string): { minX: number; minY: number; width: number; height: number } | null {
  const pts = tessellateSvgPathD(d);
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return null;
  const width = Math.max(1e-6, maxX - minX);
  const height = Math.max(1e-6, maxY - minY);
  return { minX, minY, width, height };
}

/** Miniature vector preview for the layers panel. */
export function buildPathLayerIconSpec(node: EditorNode): PathLayerIconSpec | null {
  const d = pathLayerOutlineD(node);
  if (!d.trim()) return null;

  const bounds = boundsFromPathD(d);
  if (!bounds) return null;

  const pad = Math.max(0.75, Math.max(bounds.width, bounds.height) * 0.08);
  const viewBox = `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`;

  const showFill = node.fillEnabled !== false && (node.pathClosed ?? false);
  const fill = showFill ? "currentColor" : "none";
  const stroke = showFill ? "none" : "currentColor";
  const strokeWidth = showFill
    ? 0
    : Math.max(0.5, Math.min(bounds.width, bounds.height) * 0.1);

  return { d, viewBox, fill, stroke, strokeWidth };
}
