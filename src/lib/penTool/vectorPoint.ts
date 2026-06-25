import type { PathPoint } from "@/lib/pathGeometry";
import type { VectorPoint } from "./types";

export type PathPointType = "corner" | "smooth";

export function pathPointType(p: Pick<PathPoint, "pointType">): PathPointType {
  return p.pointType ?? "corner";
}

export function pathPointToVector(p: PathPoint, selected = false): VectorPoint {
  return {
    x: p.x,
    y: p.y,
    inHandle: p.handleIn ? { ...p.handleIn } : undefined,
    outHandle: p.handleOut ? { ...p.handleOut } : undefined,
    type: pathPointType(p),
    selected,
  };
}

export function vectorToPathPoint(
  v: VectorPoint,
  id: string,
): PathPoint {
  return {
    id,
    x: v.x,
    y: v.y,
    handleIn: v.inHandle ? { ...v.inHandle } : undefined,
    handleOut: v.outHandle ? { ...v.outHandle } : undefined,
    pointType: v.type,
  };
}

/** Toggle corner ↔ smooth; smooth points get mirrored handles when created from corner. */
export function toggleVectorPointType(v: VectorPoint, defaultHandleLen: number): VectorPoint {
  if (v.type === "smooth") {
    return { ...v, type: "corner" };
  }
  const len = defaultHandleLen;
  const out = v.outHandle ?? { x: len, y: 0 };
  const inH = v.inHandle ?? { x: -out.x, y: -out.y };
  return {
    ...v,
    type: "smooth",
    outHandle: { ...out },
    inHandle: { x: -out.x, y: -out.y },
  };
}

export function togglePathPointType(
  p: PathPoint,
  defaultHandleLen: number,
): Partial<PathPoint> {
  const v = pathPointToVector(p);
  const next = toggleVectorPointType(v, defaultHandleLen);
  return {
    pointType: next.type,
    handleIn: next.inHandle,
    handleOut: next.outHandle,
  };
}
