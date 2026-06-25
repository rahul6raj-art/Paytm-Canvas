import type { PathPoint } from "@/lib/pathGeometry";
import { appendCubicSegmentD, type CubicPoint } from "@/lib/vector/bezierGeometry";
import type { PathHandleMirroring } from "@/lib/pathHandles";
import { mergePathPointHandles } from "@/lib/pathHandles";
import { effectiveHandleMirroring } from "@/lib/penTool/handleMirror";

type XY = { x: number; y: number };

/** Store handles relative to anchor: handle = pointerLocal - anchorLocal. */
export function relativeHandleFromPointer(
  anchorLocal: XY,
  pointerLocal: XY,
): XY {
  return {
    x: pointerLocal.x - anchorLocal.x,
    y: pointerLocal.y - anchorLocal.y,
  };
}

export function absoluteHandleWorldFromRelative(
  anchorLocal: XY,
  handleRelative: XY,
  nodeOriginWorld: XY,
): XY {
  return {
    x: nodeOriginWorld.x + anchorLocal.x + handleRelative.x,
    y: nodeOriginWorld.y + anchorLocal.y + handleRelative.y,
  };
}

export type HandleDragPatch = Partial<Pick<PathPoint, "handleIn" | "handleOut" | "pointType">>;

/** Build point patch from pointer position in node-local space. */
export function buildHandleDragPatch(
  point: PathPoint,
  kind: "handle-in" | "handle-out",
  pointerLocal: XY,
  opts?: { breakMirror?: boolean; nodeMirroring?: PathHandleMirroring },
): PathPoint {
  const relative = relativeHandleFromPointer({ x: point.x, y: point.y }, pointerLocal);
  const handlePatch: Partial<PathPoint> =
    kind === "handle-in" ? { handleIn: relative } : { handleOut: relative };

  let merged: PathPoint = { ...point };

  const mirroring = effectiveHandleMirroring(
    merged,
    opts?.nodeMirroring ?? "none",
    opts?.breakMirror,
  );
  const movedWhich = kind === "handle-in" ? "in" : "out";
  merged = mergePathPointHandles(merged, handlePatch, mirroring, movedWhich);
  return merged;
}

/** SVG `d` for segment points[i] → points[i + 1] using shared cubic rules. */
export function segmentPathD(points: readonly PathPoint[], segmentIndex: number): string {
  const p0 = points[segmentIndex];
  const p1 = points[segmentIndex + 1];
  if (!p0 || !p1) return "";
  return appendCubicSegmentD(`M ${p0.x} ${p0.y}`, p0 as CubicPoint, p1 as CubicPoint);
}

/** Full path `d` from path points (same as committed render). */
export function pathPointsToSvgPathD(points: readonly PathPoint[], closed = false): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    d = appendCubicSegmentD(d, points[i - 1]! as CubicPoint, points[i]! as CubicPoint);
  }
  if (closed && points.length >= 2) {
    d = appendCubicSegmentD(d, points[points.length - 1]! as CubicPoint, points[0]! as CubicPoint);
    d += " Z";
  }
  return d;
}
