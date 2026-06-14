import { Clipper, FillRule, type Path64, Paths64 } from "clipper2-js";
import {
  diagnosePaths64,
  diagnosePolygons,
  logBooleanDiagnostics,
} from "@/lib/geometry/booleanDiagnostics";
import {
  BOOLEAN_CLIPPER_SCALE,
  normalizePaths64Solution,
  normalizePolygonContour,
  polygonToPath64,
  type Point2,
} from "@/lib/geometry/booleanPolygonNormalize";

export { BOOLEAN_CLIPPER_SCALE as CLIPPER_SCALE };

export type ClipperBooleanOp = "union" | "subtract" | "intersect" | "exclude";

export type ClipperPolygonInput = {
  polygon: Point2[];
};

export type ClipperBooleanOutput = {
  pathD: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillRule: "nonzero" | "evenodd";
  fill: string;
};

export type ClipperApplyOptions = {
  /** Origin for path `d` coordinates (defaults to result bbox top-left). */
  pathOrigin?: { x: number; y: number };
};

function inputsToPaths64(inputs: ClipperPolygonInput[]): Paths64 {
  const paths = new Paths64();
  for (const inp of inputs) {
    const normalized = normalizePolygonContour(inp.polygon);
    if (!normalized) continue;
    paths.push(polygonToPath64(normalized));
  }
  return paths;
}

function boundsOfPaths64(paths: Paths64): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (paths.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    for (const pt of path) {
      const x = pt.x / BOOLEAN_CLIPPER_SCALE;
      const y = pt.y / BOOLEAN_CLIPPER_SCALE;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function path64ToPathD(path: Path64, originX: number, originY: number): string {
  if (path.length < 2) return "";
  const sx = path[0]!.x / BOOLEAN_CLIPPER_SCALE - originX;
  const sy = path[0]!.y / BOOLEAN_CLIPPER_SCALE - originY;
  let d = `M ${sx} ${sy}`;
  for (let i = 1; i < path.length; i++) {
    d += ` L ${path[i]!.x / BOOLEAN_CLIPPER_SCALE - originX} ${path[i]!.y / BOOLEAN_CLIPPER_SCALE - originY}`;
  }
  return `${d} Z`;
}

function paths64ToPathD(paths: Paths64, originX: number, originY: number): string {
  return paths
    .map((path) => path64ToPathD(path, originX, originY))
    .filter(Boolean)
    .join(" ");
}

function fillRuleForPaths(paths: Paths64): "nonzero" | "evenodd" {
  if (paths.length <= 1) return "nonzero";
  const hasHole = paths.some((path) => path.length >= 3 && !Clipper.isPositive(path));
  return hasHole ? "evenodd" : "nonzero";
}

function logStep(
  phase: string,
  operation: ClipperBooleanOp,
  polygons: Point2[][],
  paths?: Paths64,
): void {
  const inputDiag = diagnosePolygons(phase, polygons, operation);
  logBooleanDiagnostics(inputDiag);
  if (paths) {
    logBooleanDiagnostics(diagnosePaths64(`${phase}:out`, paths, operation));
  }
}

/** Single-batch union of all operands. */
function clipUnion(inputs: ClipperPolygonInput[]): Paths64 {
  const paths = inputsToPaths64(inputs);
  logStep("union:input", "union", inputs.map((i) => i.polygon));
  if (paths.length === 0) return new Paths64();
  if (paths.length === 1) return normalizePaths64Solution(paths);
  const solution = normalizePaths64Solution(
    Clipper.Union(paths, undefined, FillRule.NonZero),
  );
  logStep("union:solve", "union", [], solution);
  return solution;
}

/**
 * Subtract: first operand is subject; union of all remaining operands is the clip.
 * result = subject − union(cutters)
 */
function clipSubtract(inputs: ClipperPolygonInput[]): Paths64 {
  if (inputs.length < 2) return new Paths64();
  const subjectInput = inputs[0]!;
  const cutters = inputs.slice(1);
  logStep("subtract:input", "subtract", inputs.map((i) => i.polygon));

  const subject = inputsToPaths64([subjectInput]);
  if (subject.length === 0) return new Paths64();

  const cuttersUnion = clipUnion(cutters);
  if (cuttersUnion.length === 0) return subject;

  const solution = normalizePaths64Solution(
    Clipper.Difference(subject, cuttersUnion, FillRule.NonZero),
  );
  logStep("subtract:solve", "subtract", [], solution);
  return solution;
}

/**
 * N-ary intersect — fold pairwise with validated intermediate geometry.
 * Mathematically equivalent to a single intersect of all operands.
 */
function clipIntersect(inputs: ClipperPolygonInput[]): Paths64 {
  if (inputs.length === 0) return new Paths64();
  logStep("intersect:input", "intersect", inputs.map((i) => i.polygon));

  let acc = inputsToPaths64([inputs[0]!]);
  if (acc.length === 0) return new Paths64();

  for (let i = 1; i < inputs.length; i++) {
    const clip = inputsToPaths64([inputs[i]!]);
    if (clip.length === 0) return new Paths64();
    acc = normalizePaths64Solution(
      Clipper.Intersect(acc, clip, FillRule.NonZero),
    );
    logStep(`intersect:step${i}`, "intersect", [], acc);
    if (acc.length === 0) break;
  }
  return acc;
}

/** N-ary exclude (XOR) — fold with validated intermediate geometry. */
function clipExclude(inputs: ClipperPolygonInput[]): Paths64 {
  if (inputs.length === 0) return new Paths64();
  logStep("exclude:input", "exclude", inputs.map((i) => i.polygon));

  let acc = inputsToPaths64([inputs[0]!]);
  if (acc.length === 0) return new Paths64();

  for (let i = 1; i < inputs.length; i++) {
    const clip = inputsToPaths64([inputs[i]!]);
    if (clip.length === 0) continue;
    acc = normalizePaths64Solution(Clipper.Xor(acc, clip, FillRule.NonZero));
    logStep(`exclude:step${i}`, "exclude", [], acc);
  }
  return acc;
}

function runClip(operation: ClipperBooleanOp, inputs: ClipperPolygonInput[]): Paths64 {
  switch (operation) {
    case "union":
      return clipUnion(inputs);
    case "subtract":
      return clipSubtract(inputs);
    case "intersect":
      return clipIntersect(inputs);
    case "exclude":
      return clipExclude(inputs);
    default:
      return new Paths64();
  }
}

/**
 * Polygon boolean via Clipper2 with normalization before every solve and after
 * every intermediate step (intersect / exclude).
 */
export function clipperApplyBoolean(
  operation: ClipperBooleanOp,
  inputs: ClipperPolygonInput[],
  fill: string,
  options?: ClipperApplyOptions,
): ClipperBooleanOutput | null {
  if (inputs.length < 2) return null;

  const normalizedInputs: ClipperPolygonInput[] = [];
  for (const inp of inputs) {
    const poly = normalizePolygonContour(inp.polygon);
    if (poly) normalizedInputs.push({ polygon: poly });
  }
  if (normalizedInputs.length < 2) return null;

  const solution = runClip(operation, normalizedInputs);
  if (solution.length === 0) return null;

  const bounds = boundsOfPaths64(solution);
  if (!bounds) return null;

  const originX = options?.pathOrigin?.x ?? bounds.x;
  const originY = options?.pathOrigin?.y ?? bounds.y;
  const pathD = paths64ToPathD(solution, originX, originY);
  if (!pathD.trim()) return null;

  return {
    pathD,
    ...bounds,
    fillRule: fillRuleForPaths(solution),
    fill,
  };
}
