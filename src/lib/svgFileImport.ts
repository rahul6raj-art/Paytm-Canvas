/**
 * SVG file import — public API.
 * Implementation lives in src/lib/svgImport/.
 */
export {
  convertSvgTree,
  importSvgSourceToEditorGraph,
  importSvgFileToEditorGraph,
  isSvgLayerImportFile,
  parseSvg,
  readSvg,
  type SvgImportResult,
  type SvgImportDiagnostics,
} from "@/lib/svgImport";

import { normalizePathNode } from "@/lib/pathGeometry";
import { scaleSvgPathD } from "@/lib/svgImport/parseSvgPath";
import type { EditorNode } from "@/stores/useEditorStore";
import type { SvgImportResult } from "@/lib/svgImport";

function pointsToFlattenedPathD(points: Array<{ x: number; y: number }>, closed: boolean): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]!.x} ${points[i]!.y}`;
  }
  if (closed) d += " Z";
  return d;
}

/** Scale imported graph (used when inserting at drop position). */
export function scaleImportedEditorGraph(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootId: string,
  scale: number,
): Record<string, EditorNode> {
  if (scale === 1) return nodes;
  const out: Record<string, EditorNode> = { ...nodes };
  const walk = (id: string) => {
    const n = out[id];
    if (!n) return;
    let next: EditorNode = {
      ...n,
      x: n.x * scale,
      y: n.y * scale,
      width: Math.max(1, n.width * scale),
      height: Math.max(1, n.height * scale),
    };
    if (n.fontSize) next.fontSize = Math.max(1, n.fontSize * scale);
    if (n.strokeWidth) next.strokeWidth = Math.max(0, n.strokeWidth * scale);
    if (n.cornerRadius) next.cornerRadius = n.cornerRadius * scale;
    if (n.lineX1 != null && n.lineY1 != null && n.lineX2 != null && n.lineY2 != null) {
      next = {
        ...next,
        lineX1: n.lineX1 * scale,
        lineY1: n.lineY1 * scale,
        lineX2: n.lineX2 * scale,
        lineY2: n.lineY2 * scale,
      };
    }
    if (n.type === "path" && n.pathPoints?.length) {
      const scaledPts = n.pathPoints.map((p) => ({
        ...p,
        x: p.x * scale,
        y: p.y * scale,
        handleIn: p.handleIn ? { x: p.handleIn.x * scale, y: p.handleIn.y * scale } : undefined,
        handleOut: p.handleOut ? { x: p.handleOut.x * scale, y: p.handleOut.y * scale } : undefined,
      }));
      next = normalizePathNode({ ...next, pathPoints: scaledPts });
    } else if (n.type === "path" && n.flattenedPathData) {
      next = {
        ...next,
        flattenedPathData: scaleSvgPathD(n.flattenedPathData, scale),
      };
    }
    out[id] = next;
    for (const cid of childOrder[id] ?? []) walk(cid);
  };
  walk(rootId);
  return out;
}
