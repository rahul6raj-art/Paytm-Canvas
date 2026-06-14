import {
  applyMatrixToPoint,
  identityMatrix,
  multiplyMatrix,
  scaleMatrix,
  translateMatrix,
  type Matrix2D,
} from "@/lib/transformMath";

export type ViewBox = { minX: number; minY: number; width: number; height: number };

export function parseViewBox(raw: string | undefined): ViewBox {
  if (!raw) return { minX: 0, minY: 0, width: 0, height: 0 };
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) {
    return { minX: 0, minY: 0, width: 0, height: 0 };
  }
  return { minX: parts[0]!, minY: parts[1]!, width: parts[2]!, height: parts[3]! };
}

export function parseLength(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const n = parseFloat(value.replace(/%|px|pt|em|rem|cm|mm|in|pc/gi, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Compute root matrix: viewBox offset + viewport scaling with preserveAspectRatio. */
export function viewBoxRootMatrix(
  viewBox: ViewBox,
  viewportW: number,
  viewportH: number,
  preserveAspectRatio?: string,
): Matrix2D {
  const vbW = viewBox.width || viewportW || 1;
  const vbH = viewBox.height || viewportH || 1;
  const par = (preserveAspectRatio ?? "xMidYMid meet").trim().split(/\s+/);
  const align = par[0] ?? "xMidYMid";
  const meetOrSlice = par[1] ?? "meet";

  let scaleX = viewportW / vbW;
  let scaleY = viewportH / vbH;

  if (meetOrSlice === "meet") {
    const s = Math.min(scaleX, scaleY);
    scaleX = s;
    scaleY = s;
  } else if (meetOrSlice === "slice") {
    const s = Math.max(scaleX, scaleY);
    scaleX = s;
    scaleY = s;
  }

  const contentW = vbW * scaleX;
  const contentH = vbH * scaleY;

  let tx = 0;
  let ty = 0;
  if (align.includes("XMid")) tx = (viewportW - contentW) / 2;
  else if (align.includes("XMax")) tx = viewportW - contentW;
  if (align.includes("YMid")) ty = (viewportH - contentH) / 2;
  else if (align.includes("YMax")) ty = viewportH - contentH;

  return multiplyMatrix(
    translateMatrix(tx, ty),
    scaleMatrix(scaleX, scaleY),
    translateMatrix(-viewBox.minX, -viewBox.minY),
  );
}

export function invertMatrixSafe(m: Matrix2D): Matrix2D {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return identityMatrix();
  const invDet = 1 / det;
  return {
    a: m.d * invDet,
    b: -m.b * invDet,
    c: -m.c * invDet,
    d: m.a * invDet,
    e: (m.c * m.f - m.d * m.e) * invDet,
    f: (m.b * m.e - m.a * m.f) * invDet,
  };
}

export function transformPathPoint(
  p: { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } },
  m: Matrix2D,
  newId: () => string,
): { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number }; id: string } {
  const tp = applyMatrixToPoint(m, { x: p.x, y: p.y });
  const next: ReturnType<typeof transformPathPoint> = { id: newId(), x: tp.x, y: tp.y };
  if (p.handleIn) {
    const hi = applyMatrixToPoint(m, { x: p.x + p.handleIn.x, y: p.y + p.handleIn.y });
    next.handleIn = { x: hi.x - tp.x, y: hi.y - tp.y };
  }
  if (p.handleOut) {
    const ho = applyMatrixToPoint(m, { x: p.x + p.handleOut.x, y: p.y + p.handleOut.y });
    next.handleOut = { x: ho.x - tp.x, y: ho.y - tp.y };
  }
  return next;
}
