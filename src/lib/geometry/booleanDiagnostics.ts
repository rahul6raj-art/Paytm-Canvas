import type { ClipperBooleanOp } from "@/lib/geometry/clipperKernel";
import { BOOLEAN_CLIPPER_SCALE } from "@/lib/geometry/booleanPolygonNormalize";
import type { Paths64 } from "clipper2-js";
import type { Point2 } from "@/lib/geometry/booleanPolygonNormalize";

/** Set `BOOLEAN_DEBUG=1` to log Clipper boolean diagnostics. */
export const BOOLEAN_DEBUG_ENABLED =
  typeof process !== "undefined" && process.env?.BOOLEAN_DEBUG === "1";

export type BooleanDiagnosticReport = {
  phase: string;
  operation: ClipperBooleanOp;
  inputCount: number;
  contourCount: number;
  vertexCount: number;
  fillRule?: string;
  scaleFactor: number;
  invalidPathCount: number;
  emptyResultReason?: string;
};

function countVertices(polygons: Point2[][]): number {
  return polygons.reduce((sum, poly) => sum + poly.length, 0);
}

function countPath64Vertices(paths: Paths64): number {
  let n = 0;
  for (const path of paths) n += path.length;
  return n;
}

function invalidPolygonCount(polygons: Point2[][]): number {
  let n = 0;
  for (const poly of polygons) {
    if (poly.length < 3) n++;
    for (const p of poly) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        n++;
        break;
      }
    }
  }
  return n;
}

export function diagnosePolygons(
  phase: string,
  polygons: Point2[][],
  operation: ClipperBooleanOp,
): BooleanDiagnosticReport {
  return {
    phase,
    operation,
    inputCount: polygons.length,
    contourCount: polygons.length,
    vertexCount: countVertices(polygons),
    scaleFactor: BOOLEAN_CLIPPER_SCALE,
    invalidPathCount: invalidPolygonCount(polygons),
    emptyResultReason:
      polygons.length < 2 ? "fewer than two operands" : undefined,
  };
}

export function diagnosePaths64(
  phase: string,
  paths: Paths64,
  operation: ClipperBooleanOp,
  opts?: { emptyResultReason?: string },
): BooleanDiagnosticReport {
  let invalid = 0;
  for (const path of paths) {
    if (path.length < 3) invalid++;
  }
  return {
    phase,
    operation,
    inputCount: paths.length,
    contourCount: paths.length,
    vertexCount: countPath64Vertices(paths),
    scaleFactor: BOOLEAN_CLIPPER_SCALE,
    invalidPathCount: invalid,
    emptyResultReason:
      opts?.emptyResultReason ??
      (paths.length === 0 ? "clipper returned no contours" : undefined),
  };
}

export function logBooleanDiagnostics(report: BooleanDiagnosticReport): void {
  if (!BOOLEAN_DEBUG_ENABLED) return;
  // eslint-disable-next-line no-console
  console.debug("[boolean]", {
    phase: report.phase,
    operation: report.operation,
    inputCount: report.inputCount,
    contourCount: report.contourCount,
    vertexCount: report.vertexCount,
    fillRule: report.fillRule,
    scaleFactor: report.scaleFactor,
    invalidPathCount: report.invalidPathCount,
    emptyResultReason: report.emptyResultReason,
  });
}
