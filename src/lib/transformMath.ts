import type { ResizeHandle } from "@/lib/resize";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

export type RectBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SvgNodeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

const ROT_EPS = 1e-9;

/** Finite canvas coordinate (falls back when NaN/Infinity). */
export function finiteCoord(value: number, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Positive finite size for layout/transform (Math.max(1, NaN) is still NaN). */
export function finiteDimension(value: number, min = 1): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min ? value : min;
}

export function normalizeRotationDegrees(rotation?: number): number {
  if (rotation == null || !Number.isFinite(rotation)) return 0;
  return ((rotation % 360) + 360) % 360;
}

export function hasRotation(rotation?: number): boolean {
  const r = normalizeRotationDegrees(rotation);
  return Math.abs(r) > ROT_EPS && Math.abs(r - 360) > ROT_EPS;
}

/** Local placement + size + rotation for a node (matches DOM box model). */
export function nodeTransform(node: EditorNode): SvgNodeTransform {
  return {
    x: finiteCoord(node.x),
    y: finiteCoord(node.y),
    width: finiteDimension(node.width),
    height: finiteDimension(node.height),
    rotation: normalizeRotationDegrees(node.rotation),
  };
}

/** SVG rotate around node center (transform-origin: 50% 50%). Empty when rotation is 0. */
export function rotationTransform(
  node: EditorNode | Pick<SvgNodeTransform, "width" | "height" | "rotation">,
): string {
  const width = Math.max(1, "width" in node ? node.width : 1);
  const height = Math.max(1, "height" in node ? node.height : 1);
  const rotation = normalizeRotationDegrees("rotation" in node ? node.rotation : 0);
  if (!hasRotation(rotation)) return "";
  return `rotate(${rotation} ${width / 2} ${height / 2})`;
}

function composeTranslateRotate(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
): string {
  const parts = [`translate(${x},${y})`];
  const rot = rotationTransform({ width, height, rotation });
  if (rot) parts.push(rot);
  return parts.join(" ");
}

/** Child placement in parent local space: translate(x,y) + center rotation. */
export function composeSvgTransform(node: EditorNode): string {
  const t = nodeTransform(node);
  return composeTranslateRotate(t.x, t.y, t.width, t.height, t.rotation);
}

/** Root / world placement: translate(worldX, worldY) + center rotation. */
export function composeSvgWorldTransform(
  node: EditorNode,
  worldX: number,
  worldY: number,
): string {
  const t = nodeTransform(node);
  return composeTranslateRotate(worldX, worldY, t.width, t.height, t.rotation);
}

/** Rotate a point around a center by degrees (counter-clockwise, SVG/CSS convention). */
export function rotatePointAroundCenter(
  point: { x: number; y: number },
  center: { x: number; y: number },
  degrees: number,
): { x: number; y: number } {
  if (!hasRotation(degrees)) return { x: point.x, y: point.y };
  const rad = (normalizeRotationDegrees(degrees) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Four corners of an axis-aligned rect after rotation around its center (nw, ne, se, sw). */
export function getRotatedRectCorners(
  bounds: RectBounds,
  rotationDeg: number,
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const center = { x: bounds.x + w / 2, y: bounds.y + h / 2 };
  const nw = { x: bounds.x, y: bounds.y };
  const ne = { x: bounds.x + w, y: bounds.y };
  const se = { x: bounds.x + w, y: bounds.y + h };
  const sw = { x: bounds.x, y: bounds.y + h };
  return [
    rotatePointAroundCenter(nw, center, rotationDeg),
    rotatePointAroundCenter(ne, center, rotationDeg),
    rotatePointAroundCenter(se, center, rotationDeg),
    rotatePointAroundCenter(sw, center, rotationDeg),
  ];
}

const LOCAL_HANDLE_POINTS: Record<ResizeHandle, (b: RectBounds) => { x: number; y: number }> = {
  nw: (b) => ({ x: b.x, y: b.y }),
  n: (b) => ({ x: b.x + b.width / 2, y: b.y }),
  ne: (b) => ({ x: b.x + b.width, y: b.y }),
  e: (b) => ({ x: b.x + b.width, y: b.y + b.height / 2 }),
  se: (b) => ({ x: b.x + b.width, y: b.y + b.height }),
  s: (b) => ({ x: b.x + b.width / 2, y: b.y + b.height }),
  sw: (b) => ({ x: b.x, y: b.y + b.height }),
  w: (b) => ({ x: b.x, y: b.y + b.height / 2 }),
};

const HANDLE_ORDER: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** World-space center of each resize handle on a rotated rect. */
export function getRotatedHandlePositions(
  bounds: RectBounds,
  rotationDeg: number,
): { handle: ResizeHandle; x: number; y: number }[] {
  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const box: RectBounds = { x: bounds.x, y: bounds.y, width: w, height: h };
  const center = { x: box.x + w / 2, y: box.y + h / 2 };
  return HANDLE_ORDER.map((handle) => {
    const p = LOCAL_HANDLE_POINTS[handle](box);
    const rotated = rotatePointAroundCenter(p, center, rotationDeg);
    return { handle, x: rotated.x, y: rotated.y };
  });
}

const HANDLE_BASE_ANGLE: Record<ResizeHandle, number> = {
  e: 0,
  ne: 135,
  n: 90,
  nw: 45,
  w: 180,
  sw: 315,
  s: 270,
  se: 225,
};

const CURSOR_BY_SNAPPED_ANGLE: Record<number, string> = {
  0: "ew-resize",
  45: "nwse-resize",
  90: "ns-resize",
  135: "nesw-resize",
  180: "ew-resize",
  225: "nwse-resize",
  270: "ns-resize",
  315: "nesw-resize",
};

/** Nearest 8-way resize cursor for a handle on a rotated node. */
export function resizeCursorForRotatedHandle(handle: ResizeHandle, rotationDeg: number): string {
  const combined = normalizeRotationDegrees(HANDLE_BASE_ANGLE[handle] + rotationDeg);
  const snapped = (Math.round(combined / 45) * 45) % 360;
  return CURSOR_BY_SNAPPED_ANGLE[snapped] ?? "nwse-resize";
}

/** Axis-aligned bounds of a rectangle rotated around its center (degrees). */
export function rotatedBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
): { x: number; y: number; width: number; height: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  if (!hasRotation(rotationDeg)) {
    return { x, y, width: w, height: h };
  }
  const corners = getRotatedRectCorners({ x, y, width: w, height: h }, rotationDeg);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export type InverseTransformInput = SvgNodeTransform & {
  /** When set, used instead of `x`/`y` as the transform origin (world top-left). */
  worldX?: number;
  worldY?: number;
};

/** Map a world-space point into the node's unrotated local coordinates (top-left origin). */
export function inverseTransformPoint(
  point: { x: number; y: number },
  transform: InverseTransformInput,
): { x: number; y: number } {
  const ox = transform.worldX ?? transform.x;
  const oy = transform.worldY ?? transform.y;
  const w = Math.max(1, transform.width);
  const h = Math.max(1, transform.height);
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;
  if (!hasRotation(transform.rotation)) {
    return { x: point.x - ox, y: point.y - oy };
  }
  const rad = (-normalizeRotationDegrees(transform.rotation) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return { x: lx + w / 2, y: ly + h / 2 };
}

/** SVG scale/rotate around node center (local geometry at 0,0). */
export function layerTransformSvg(node: EditorNode): string {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const cx = w / 2;
  const cy = h / 2;
  const parts: string[] = [];
  const { sx, sy } = layerFlipScale(node);
  if (sx !== 1 || sy !== 1) {
    parts.push(`translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`);
  }
  const rot = rotationTransform(node);
  if (rot) parts.push(rot);
  return parts.join(" ");
}

/** Wrap local SVG markup with center flip/rotation (standalone export at 0,0). */
export function wrapSvgNodeRotation(inner: string, node: EditorNode): string {
  const t = layerTransformSvg(node);
  if (!t) return inner;
  return `<g transform="${t}">${inner}</g>`;
}

/** CSS transform matching DOM CanvasObject (center origin). */
export function cssRotationStyle(node: EditorNode): {
  transform?: string;
  transformOrigin?: string;
} {
  const transform = buildLayerCssTransform(node);
  if (!transform) return {};
  return { transform, transformOrigin: "50% 50%" };
}

// --- 2D affine matrix utilities (SSR-safe; DOMMatrix when available) ---

export type Matrix2D = { a: number; b: number; c: number; d: number; e: number; f: number };

export function matrixIsFinite(m: Matrix2D): boolean {
  return (
    Number.isFinite(m.a) &&
    Number.isFinite(m.b) &&
    Number.isFinite(m.c) &&
    Number.isFinite(m.d) &&
    Number.isFinite(m.e) &&
    Number.isFinite(m.f)
  );
}

function fromDomMatrix(dm: DOMMatrix): Matrix2D {
  return { a: dm.a, b: dm.b, c: dm.c, d: dm.d, e: dm.e, f: dm.f };
}

function toDomMatrix(m: Matrix2D): DOMMatrix {
  return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);
}

export function identityMatrix(): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

export function translateMatrix(tx: number, ty: number): Matrix2D {
  if (typeof DOMMatrix !== "undefined") {
    return fromDomMatrix(new DOMMatrix().translate(tx, ty));
  }
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

export function rotateMatrix(deg: number, cx = 0, cy = 0): Matrix2D {
  if (typeof DOMMatrix !== "undefined") {
    return fromDomMatrix(new DOMMatrix().translate(cx, cy).rotate(deg).translate(-cx, -cy));
  }
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const t1 = translateMatrix(cx, cy);
  const r = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  const t2 = translateMatrix(-cx, -cy);
  return multiplyMatrix(multiplyMatrix(t1, r), t2);
}

export function scaleMatrix(sx: number, sy: number, cx = 0, cy = 0): Matrix2D {
  if (typeof DOMMatrix !== "undefined") {
    return fromDomMatrix(new DOMMatrix().translate(cx, cy).scale(sx, sy).translate(-cx, -cy));
  }
  const t1 = translateMatrix(cx, cy);
  const s = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
  const t2 = translateMatrix(-cx, -cy);
  return multiplyMatrix(multiplyMatrix(t1, s), t2);
}

export function layerFlipScale(node: Pick<EditorNode, "flipHorizontal" | "flipVertical">): {
  sx: number;
  sy: number;
} {
  return {
    sx: node.flipHorizontal ? -1 : 1,
    sy: node.flipVertical ? -1 : 1,
  };
}

export function buildLayerCssTransform(
  node: Pick<EditorNode, "rotation" | "flipHorizontal" | "flipVertical">,
): string | undefined {
  const parts: string[] = [];
  const r = normalizeRotationDegrees(node.rotation);
  if (hasRotation(r)) parts.push(`rotate(${r}deg)`);
  const { sx, sy } = layerFlipScale(node);
  if (sx === -1 && sy === -1) parts.push("scale(-1)");
  else if (sx === -1) parts.push("scaleX(-1)");
  else if (sy === -1) parts.push("scaleY(-1)");
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function multiplyMatrix(a: Matrix2D, b: Matrix2D): Matrix2D {
  if (typeof DOMMatrix !== "undefined") {
    return fromDomMatrix(toDomMatrix(a).multiply(toDomMatrix(b)));
  }
  return {
    a: a.a * b.a + a.c * b.b,
    b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d,
    d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e,
    f: a.b * b.e + a.d * b.f + a.f,
  };
}

export function applyMatrixToPoint(m: Matrix2D, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: m.a * point.x + m.c * point.y + m.e,
    y: m.b * point.x + m.d * point.y + m.f,
  };
}

export function invertMatrix(m: Matrix2D): Matrix2D | null {
  if (typeof DOMMatrix !== "undefined") {
    try {
      const inv = toDomMatrix(m).inverse();
      if (!Number.isFinite(inv.a)) return null;
      return fromDomMatrix(inv);
    } catch {
      return null;
    }
  }
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return null;
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

export function matrixHasRotation(m: Matrix2D): boolean {
  return Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6;
}

export function getMatrixRotationDegrees(m: Matrix2D): number {
  return normalizeRotationDegrees((Math.atan2(m.b, m.a) * 180) / Math.PI);
}

export function matrixToCssTransform(m: Matrix2D): string {
  return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
}

export function matrixToSvgTransform(m: Matrix2D): string {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

export function resolveParentId(parentId: string | null | undefined): string | null {
  if (!parentId || parentId === EDITOR_ROOT_KEY) return null;
  return parentId;
}

/** Sum of parent translations only (legacy fallback; no rotation). */
export function worldRectSum(
  id: string,
  nodes: Record<string, EditorNode>,
): RectBounds {
  const n = nodes[id];
  if (!n) return { x: 0, y: 0, width: 0, height: 0 };
  let x = n.x;
  let y = n.y;
  let p = n.parentId;
  while (p) {
    if (p === EDITOR_ROOT_KEY) break;
    const pn = nodes[p];
    if (!pn) break;
    x += pn.x;
    y += pn.y;
    p = pn.parentId;
  }
  return { x, y, width: n.width, height: n.height };
}

/** Local matrix: translate(x,y), flip/scale, then rotate around node center. */
export function getNodeLocalMatrix(node: EditorNode): Matrix2D {
  const w = finiteDimension(node.width);
  const h = finiteDimension(node.height);
  const cx = w / 2;
  const cy = h / 2;
  let m = translateMatrix(finiteCoord(node.x), finiteCoord(node.y));
  const { sx, sy } = layerFlipScale(node);
  if (sx !== 1 || sy !== 1) {
    m = multiplyMatrix(m, scaleMatrix(sx, sy, cx, cy));
  }
  if (hasRotation(node.rotation)) {
    m = multiplyMatrix(m, rotateMatrix(node.rotation ?? 0, cx, cy));
  }
  return m;
}

/** Full world matrix from canvas root to node local geometry space. */
export function getNodeWorldMatrix(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): Matrix2D | null {
  const n = nodes[nodeId];
  if (!n) return null;
  try {
    const local = getNodeLocalMatrix(n);
    const parentId = resolveParentId(n.parentId);
    if (!parentId || !nodes[parentId]) return local;
    const parentWorld = getNodeWorldMatrix(parentId, nodes);
    if (!parentWorld) return local;
    return multiplyMatrix(parentWorld, local);
  } catch {
    return null;
  }
}

export function getNodeWorldInverseMatrix(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): Matrix2D | null {
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (!wm) return null;
  return invertMatrix(wm);
}

export type WorldCorner = { x: number; y: number };

/** World-space corners of the node's unrotated box (nw, ne, se, sw). */
export function getNodeTransformedWorldCorners(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): [WorldCorner, WorldCorner, WorldCorner, WorldCorner] | null {
  const n = nodes[nodeId];
  if (!n) return null;
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (!wm) {
    const wr = worldRectSum(nodeId, nodes);
    return getRotatedRectCorners(wr, n.rotation ?? 0);
  }
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  const local = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ] as const;
  return local.map((p) => applyMatrixToPoint(wm, p)) as [
    WorldCorner,
    WorldCorner,
    WorldCorner,
    WorldCorner,
  ];
}

function boundsFromCorners(corners: WorldCorner[]): RectBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Axis-aligned world bounds enclosing the fully transformed node box. */
export function getNodeTransformedWorldBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): RectBounds {
  const corners = getNodeTransformedWorldCorners(nodeId, nodes);
  if (!corners) return worldRectSum(nodeId, nodes);
  return boundsFromCorners(corners);
}

/** World-space resize handle centers from a world matrix and local box size. */
export function getWorldHandlesFromMatrix(
  wm: Matrix2D,
  width: number,
  height: number,
): { handle: ResizeHandle; x: number; y: number }[] {
  const w = finiteDimension(width);
  const h = finiteDimension(height);
  const box: RectBounds = { x: 0, y: 0, width: w, height: h };
  return HANDLE_ORDER.map((handle) => {
    const p = LOCAL_HANDLE_POINTS[handle](box);
    const world = applyMatrixToPoint(wm, p);
    return { handle, x: world.x, y: world.y };
  });
}

/** World-space resize handle centers for a node (includes parent rotation). */
export function getNodeTransformedWorldHandles(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): { handle: ResizeHandle; x: number; y: number }[] | null {
  const n = nodes[nodeId];
  if (!n) return null;
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (!wm) return null;
  return getWorldHandlesFromMatrix(wm, n.width, n.height);
}

export function nodeNeedsOrientedOverlay(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): boolean {
  const wm = getNodeWorldMatrix(nodeId, nodes);
  return wm ? matrixHasRotation(wm) : hasRotation(nodes[nodeId]?.rotation);
}

/** World point → node's local geometry coordinates (top-left origin). */
export function worldToNodeLocal(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  const inv = getNodeWorldInverseMatrix(nodeId, nodes);
  if (!inv) {
    const n = nodes[nodeId];
    if (!n) return { x: worldX, y: worldY };
    const wr = worldRectSum(nodeId, nodes);
    return inverseTransformPoint(
      { x: worldX, y: worldY },
      {
        x: n.x,
        y: n.y,
        width: Math.max(1, n.width),
        height: Math.max(1, n.height),
        rotation: n.rotation ?? 0,
        worldX: wr.x,
        worldY: wr.y,
      },
    );
  }
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

/** World point → immediate parent's local coordinates. */
export function worldToParentLocal(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  const n = nodes[nodeId];
  if (!n) return { x: worldX, y: worldY };
  const parentId = resolveParentId(n.parentId);
  if (!parentId) return { x: worldX, y: worldY };
  const inv = getNodeWorldInverseMatrix(parentId, nodes);
  if (!inv) {
    const pw = worldRectSum(parentId, nodes);
    return { x: worldX - pw.x, y: worldY - pw.y };
  }
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

/** World position of the node's local origin (0,0). */
export function getNodeWorldOrigin(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (!wm) {
    const wr = worldRectSum(nodeId, nodes);
    return { x: wr.x, y: wr.y };
  }
  return applyMatrixToPoint(wm, { x: 0, y: 0 });
}

/** Solve for node x/y so the local origin maps to a desired world point. */
export function worldOriginToNodeXY(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  desiredWorldOrigin: { x: number; y: number },
): { x: number; y: number } {
  const n = nodes[nodeId];
  if (!n) return desiredWorldOrigin;
  const inParent = worldToParentLocal(desiredWorldOrigin.x, desiredWorldOrigin.y, nodeId, nodes);

  if (!hasRotation(n.rotation)) {
    return { x: inParent.x, y: inParent.y };
  }

  let x = n.x;
  let y = n.y;
  for (let i = 0; i < 8; i++) {
    const got = applyMatrixToPoint(getNodeLocalMatrix({ ...n, x, y }), { x: 0, y: 0 });
    const errX = inParent.x - got.x;
    const errY = inParent.y - got.y;
    if (Math.abs(errX) < 1e-4 && Math.abs(errY) < 1e-4) break;
    x += errX;
    y += errY;
  }
  return { x, y };
}

/** Hit-test: is a world point inside the node's transformed box? */
export function pointInNodeWorldBounds(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
): boolean {
  const n = nodes[nodeId];
  if (!n) return false;
  const local = worldToNodeLocal(worldX, worldY, nodeId, nodes);
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  return local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h;
}
