import type { PathHandleMirroring } from "@/lib/pathHandles";
import type { PathPoint } from "@/lib/pathGeometry";
import { pathPointType } from "./vectorPoint";

/** Resolve mirroring for a point: smooth mirrors by default; Alt breaks symmetry. */
export function effectiveHandleMirroring(
  point: PathPoint,
  nodeMirroring: PathHandleMirroring,
  breakMirror?: boolean,
): PathHandleMirroring {
  if (breakMirror) return "none";
  const t = pathPointType(point);
  if (t === "smooth") return "angle-length";
  if (t === "corner") return "none";
  return nodeMirroring;
}

/** Handles for a new smooth point from click-drag (mirrored in/out). */
export function smoothPointHandlesFromDrag(
  anchor: { x: number; y: number },
  drag: { x: number; y: number },
): { outHandle: { x: number; y: number }; inHandle: { x: number; y: number } } {
  const hx = drag.x - anchor.x;
  const hy = drag.y - anchor.y;
  return {
    outHandle: { x: hx, y: hy },
    inHandle: { x: -hx, y: -hy },
  };
}

/** Update previous point's out handle when placing a smooth segment. */
export function previousPointOutHandle(
  anchor: { x: number; y: number },
  drag: { x: number; y: number },
  prevAnchor: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: anchor.x - prevAnchor.x + (drag.x - anchor.x),
    y: anchor.y - prevAnchor.y + (drag.y - anchor.y),
  };
}
