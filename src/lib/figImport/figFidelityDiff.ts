import type {
  FidelityCategory,
  FidelityEngine,
  FidelityMismatch,
  FigmaComparableSnapshot,
  NodeFidelityReport,
} from "@/lib/figImport/figFidelityTypes";

const TOLERANCE_PX = 1;
const TOLERANCE_ROTATION = 0.5;
const TOLERANCE_OPACITY = 0.02;

type CompareField = {
  field: keyof FigmaComparableSnapshot;
  category: FidelityCategory;
  engine: FidelityEngine;
  impact: number;
  tolerance?: number;
  normalize?: (v: unknown) => string | number | boolean | null;
};

const FIELDS: CompareField[] = [
  { field: "x", category: "geometry", engine: "layout", impact: 90 },
  { field: "y", category: "geometry", engine: "layout", impact: 90 },
  { field: "width", category: "geometry", engine: "layout", impact: 85 },
  { field: "height", category: "geometry", engine: "layout", impact: 85 },
  { field: "rotation", category: "transform", engine: "layout", impact: 70, tolerance: TOLERANCE_ROTATION },
  { field: "flipHorizontal", category: "transform", engine: "layout", impact: 60 },
  { field: "flipVertical", category: "transform", engine: "layout", impact: 60 },
  { field: "opacity", category: "fill", engine: "effects", impact: 40, tolerance: TOLERANCE_OPACITY },
  { field: "fill", category: "fill", engine: "gradients", impact: 75 },
  { field: "fillOpacity", category: "fill", engine: "gradients", impact: 50, tolerance: TOLERANCE_OPACITY },
  { field: "fillType", category: "gradient", engine: "gradients", impact: 80 },
  { field: "fillGradient", category: "gradient", engine: "gradients", impact: 85 },
  { field: "fillTokenId", category: "variables", engine: "variables", impact: 65 },
  { field: "strokeColor", category: "stroke", engine: "stroke", impact: 70 },
  { field: "strokeWidth", category: "stroke", engine: "stroke", impact: 75, tolerance: 0.5 },
  { field: "strokeOpacity", category: "stroke", engine: "stroke", impact: 45, tolerance: TOLERANCE_OPACITY },
  { field: "cornerRadius", category: "cornerRadius", engine: "layout", impact: 55, tolerance: 0.5 },
  { field: "effects", category: "effects", engine: "effects", impact: 80 },
  { field: "blendMode", category: "effects", engine: "effects", impact: 35 },
  { field: "content", category: "text", engine: "text", impact: 85 },
  { field: "fontFamily", category: "text", engine: "text", impact: 60 },
  { field: "fontSize", category: "text", engine: "text", impact: 70, tolerance: 0.5 },
  { field: "fontWeight", category: "text", engine: "text", impact: 50 },
  { field: "lineHeight", category: "text", engine: "text", impact: 45, tolerance: 0.05 },
  { field: "letterSpacing", category: "text", engine: "text", impact: 40, tolerance: 0.5 },
  { field: "textAlign", category: "text", engine: "text", impact: 40 },
  { field: "verticalAlign", category: "text", engine: "text", impact: 35 },
  { field: "textStyleTokenId", category: "variables", engine: "variables", impact: 55 },
  { field: "layoutMode", category: "autoLayout", engine: "layout", impact: 95 },
  { field: "layoutGap", category: "autoLayout", engine: "layout", impact: 60, tolerance: 1 },
  { field: "paddingTop", category: "autoLayout", engine: "layout", impact: 50, tolerance: 1 },
  { field: "paddingRight", category: "autoLayout", engine: "layout", impact: 50, tolerance: 1 },
  { field: "paddingBottom", category: "autoLayout", engine: "layout", impact: 50, tolerance: 1 },
  { field: "paddingLeft", category: "autoLayout", engine: "layout", impact: 50, tolerance: 1 },
  { field: "primaryAxisAlign", category: "autoLayout", engine: "layout", impact: 55 },
  { field: "counterAxisAlign", category: "autoLayout", engine: "layout", impact: 55 },
  { field: "layoutSizingHorizontal", category: "autoLayout", engine: "layout", impact: 70 },
  { field: "layoutSizingVertical", category: "autoLayout", engine: "layout", impact: 70 },
  { field: "layoutPositioning", category: "autoLayout", engine: "layout", impact: 65 },
  { field: "layoutWrap", category: "autoLayout", engine: "layout", impact: 45 },
  { field: "constraintsHorizontal", category: "constraints", engine: "constraints", impact: 60 },
  { field: "constraintsVertical", category: "constraints", engine: "constraints", impact: 60 },
  { field: "isComponent", category: "component", engine: "components", impact: 80 },
  { field: "componentId", category: "component", engine: "components", impact: 50 },
  { field: "sourceComponentId", category: "component", engine: "components", impact: 75 },
  { field: "clipChildren", category: "geometry", engine: "masks", impact: 55 },
  { field: "isMask", category: "geometry", engine: "masks", impact: 70 },
  { field: "booleanOperation", category: "geometry", engine: "masks", impact: 75 },
];

function norm(v: unknown): string | number | boolean | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "string") return v.trim().toLowerCase();
  if (Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

function valuesMatch(
  figma: string | number | boolean | null,
  canvas: string | number | boolean | null,
  tolerance?: number,
): boolean {
  if (figma === canvas) return true;
  if (figma == null && canvas == null) return true;
  if (typeof figma === "number" && typeof canvas === "number" && tolerance != null) {
    return Math.abs(figma - canvas) <= tolerance;
  }
  if (typeof figma === "string" && typeof canvas === "string") {
    return figma.replace(/\s+/g, "") === canvas.replace(/\s+/g, "");
  }
  return false;
}

function formatDelta(
  figma: string | number | boolean | null,
  canvas: string | number | boolean | null,
): string | undefined {
  if (typeof figma === "number" && typeof canvas === "number") {
    const d = canvas - figma;
    if (Math.abs(d) < 0.01) return undefined;
    return d > 0 ? `+${round(d)}` : `${round(d)}`;
  }
  return undefined;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function diffSnapshots(
  figma: FigmaComparableSnapshot,
  canvas: FigmaComparableSnapshot,
): FidelityMismatch[] {
  const mismatches: FidelityMismatch[] = [];

  for (const spec of FIELDS) {
    const fv = norm(figma[spec.field]);
    const cv = norm(canvas[spec.field]);
    if (valuesMatch(fv, cv, spec.tolerance)) continue;
    mismatches.push({
      category: spec.category,
      field: spec.field,
      figmaValue: fv,
      canvasValue: cv,
      delta: formatDelta(fv, cv),
      impact: spec.impact,
      engine: spec.engine,
      message: `${spec.field}: Figma ${String(fv ?? "—")} → Canvas ${String(cv ?? "—")}`,
    });
  }

  if (figma.cornerRadii && canvas.cornerRadii) {
    const f = JSON.stringify(figma.cornerRadii);
    const c = JSON.stringify(canvas.cornerRadii);
    if (f !== c) {
      mismatches.push({
        category: "cornerRadius",
        field: "cornerRadii",
        figmaValue: f,
        canvasValue: c,
        impact: 60,
        engine: "layout",
        message: "Per-corner radius mismatch",
      });
    }
  }

  for (const feat of figma.unsupported ?? []) {
    mismatches.push({
      category: "unsupported",
      field: "unsupported",
      figmaValue: feat,
      canvasValue: null,
      impact: 30,
      engine: "import",
      message: `Unsupported in import: ${feat}`,
    });
  }

  return mismatches.sort((a, b) => b.impact - a.impact);
}

export function nodeFidelityReport(
  nodeId: string,
  figma: FigmaComparableSnapshot,
  canvas: FigmaComparableSnapshot,
): NodeFidelityReport {
  const mismatches = diffSnapshots(figma, canvas);
  const maxImpact = mismatches.reduce((s, m) => s + m.impact, 0);
  const fidelityScore = Math.max(0, Math.round(100 - Math.min(100, maxImpact * 0.35)));

  return {
    nodeId,
    nodeName: canvas.name || figma.name,
    nodeType: canvas.nodeType,
    fidelityScore,
    mismatches,
    figBounds: {
      x: figma.x,
      y: figma.y,
      width: figma.width,
      height: figma.height,
    },
    canvasBounds: {
      x: canvas.x,
      y: canvas.y,
      width: canvas.width,
      height: canvas.height,
    },
    positionDelta: {
      dx: round(canvas.x - figma.x),
      dy: round(canvas.y - figma.y),
    },
    sizeDelta: {
      dw: round(canvas.width - figma.width),
      dh: round(canvas.height - figma.height),
    },
  };
}

export function isGeometryMismatch(m: FidelityMismatch): boolean {
  return m.category === "geometry" || m.category === "transform";
}
