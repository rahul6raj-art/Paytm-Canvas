import { newPathPointId, normalizePathNode, type PathPoint } from "@/lib/pathGeometry";
import {
  absoluteSegmentsToPathD,
  parseSvgPathToAbsolute,
  type AbsolutePathSegment,
} from "@/lib/svgImport/parseSvgPath";
import { invertMatrixSafe, transformPathPoint } from "@/lib/svgImport/svgMatrix";
import { multiplyMatrix, type Matrix2D } from "@/lib/transformMath";

export type ConvertedSvgPath = {
  pathPoints: PathPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
  pathClosed: boolean;
  pathFillRule?: "nonzero" | "evenodd";
  flattenedPathData?: string;
};

/** Convert SVG path `d` into editable path points in parent-local space. */
export function convertSvgPathToVector(
  d: string,
  worldMatrix: Matrix2D,
  parentWorldMatrix: Matrix2D,
  fillRule?: "nonzero" | "evenodd",
  warnings?: string[],
): ConvertedSvgPath | null {
  const segments = parseSvgPathToAbsolute(d, warnings);
  if (segments.length === 0) return null;

  const points = segmentsToPathPoints(segments);
  if (points.length < 2) return null;

  const pathClosed =
    segments.some((s) => s.type === "Z") || isPathImplicitlyClosed(points);

  const parentInv = invertMatrixSafe(parentWorldMatrix);
  const toParent = multiplyMatrix(parentInv, worldMatrix);
  const parentPts = points.map((p) => transformPathPoint(p, toParent, newPathPointId));

  const normalized = normalizePathNode({
    type: "path",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    pathPoints: parentPts,
  });

  const flatSegments =
    pathClosed && !segments.some((s) => s.type === "Z")
      ? [...segments, { type: "Z" as const }]
      : segments;
  const flattenedPathData = absoluteSegmentsToPathD(transformSegments(flatSegments, toParent));

  return {
    pathPoints: normalized.pathPoints ?? [],
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    pathClosed,
    pathFillRule: fillRule,
    flattenedPathData,
  };
}

function isPathImplicitlyClosed(points: PathPoint[], tolerance = 0.5): boolean {
  if (points.length < 3) return false;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return Math.hypot(first.x - last.x, first.y - last.y) <= tolerance;
}

function segmentsToPathPoints(segments: AbsolutePathSegment[]): PathPoint[] {
  const points: PathPoint[] = [];
  for (const seg of segments) {
    if (seg.type === "M") {
      points.push({ id: newPathPointId(), x: seg.x, y: seg.y });
    } else if (seg.type === "L") {
      points.push({ id: newPathPointId(), x: seg.x, y: seg.y });
    } else if (seg.type === "C") {
      const prev = points[points.length - 1];
      if (prev) {
        prev.handleOut = { x: seg.x1 - prev.x, y: seg.y1 - prev.y };
      }
      points.push({
        id: newPathPointId(),
        x: seg.x,
        y: seg.y,
        handleIn: prev ? { x: seg.x2 - seg.x, y: seg.y2 - seg.y } : undefined,
      });
    }
  }
  return points;
}

function transformSegments(segments: AbsolutePathSegment[], m: Matrix2D): AbsolutePathSegment[] {
  const map = (x: number, y: number) => {
    const p = transformPathPoint({ x, y }, m, newPathPointId);
    return { x: p.x, y: p.y };
  };
  return segments.map((seg) => {
    if (seg.type === "M") {
      const p = map(seg.x, seg.y);
      return { type: "M", x: p.x, y: p.y };
    }
    if (seg.type === "L") {
      const p = map(seg.x, seg.y);
      return { type: "L", x: p.x, y: p.y };
    }
    if (seg.type === "C") {
      const p1 = map(seg.x1, seg.y1);
      const p2 = map(seg.x2, seg.y2);
      const p = map(seg.x, seg.y);
      return { type: "C", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y };
    }
    return { type: "Z" };
  });
}
