/** Minimum width / height in canvas (local) units */
export const RESIZE_MIN_DIMENSION = 8;

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** Mid-edge handles used for resize (corners are rotate-only in the selection UI). */
export const EDGE_RESIZE_HANDLES: ResizeHandle[] = ["n", "e", "s", "w"];

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeModifiers {
  shiftKey: boolean;
  altKey: boolean;
}

export type ResizeKind =
  | "rectangle"
  | "ellipse"
  | "frame"
  | "text"
  | "line"
  | "arrow"
  | "polygon"
  | "path"
  | "group"
  | "image";

const MIN = RESIZE_MIN_DIMENSION;

export function isEdgeHandle(handle: ResizeHandle): boolean {
  return handle === "n" || handle === "s" || handle === "e" || handle === "w";
}

/** Figma-like proportional resize (Shift+Option, or Shift on a corner). */
export function isProportionalResize(handle: ResizeHandle, modifiers: ResizeModifiers): boolean {
  if (modifiers.shiftKey && modifiers.altKey) return true;
  if (modifiers.shiftKey && !isEdgeHandle(handle)) return true;
  return false;
}

function anchoredResize(handle: ResizeHandle, s: Bounds, px: number, py: number): Bounds {
  const L = s.x;
  const T = s.y;
  const R = s.x + s.width;
  const B = s.y + s.height;
  let x = L;
  let y = T;
  let w = s.width;
  let h = s.height;

  switch (handle) {
    case "e":
      x = L;
      w = Math.max(MIN, px - L);
      break;
    case "w":
      w = Math.max(MIN, R - px);
      x = R - w;
      break;
    case "s":
      y = T;
      h = Math.max(MIN, py - T);
      break;
    case "n":
      h = Math.max(MIN, B - py);
      y = B - h;
      break;
    case "se":
      x = L;
      y = T;
      w = Math.max(MIN, px - L);
      h = Math.max(MIN, py - T);
      break;
    case "sw":
      y = T;
      w = Math.max(MIN, R - px);
      x = R - w;
      h = Math.max(MIN, py - T);
      break;
    case "ne":
      x = L;
      w = Math.max(MIN, px - L);
      h = Math.max(MIN, B - py);
      y = B - h;
      break;
    case "nw":
      w = Math.max(MIN, R - px);
      h = Math.max(MIN, B - py);
      x = R - w;
      y = B - h;
      break;
    default:
      break;
  }
  return { x, y, width: w, height: h };
}

function shiftAnchoredResize(handle: ResizeHandle, s: Bounds, px: number, py: number): Bounds {
  const L = s.x;
  const T = s.y;
  const W = s.width;
  const H = s.height;
  const R = L + W;
  const B = T + H;
  const ar = W / H;
  const minScaleW = MIN / W;
  const minScaleH = MIN / H;

  switch (handle) {
    case "se": {
      const sx = (px - L) / W;
      const sy = (py - T) / H;
      const scale = Math.max(sx, sy, minScaleW, minScaleH);
      const w = W * scale;
      const h = H * scale;
      return { x: L, y: T, width: w, height: h };
    }
    case "nw": {
      const sx = (R - px) / W;
      const sy = (B - py) / H;
      const scale = Math.max(sx, sy, minScaleW, minScaleH);
      const w = W * scale;
      const h = H * scale;
      return { x: R - w, y: B - h, width: w, height: h };
    }
    case "ne": {
      const sx = (px - L) / W;
      const sy = (B - py) / H;
      const scale = Math.max(sx, sy, minScaleW, minScaleH);
      const w = W * scale;
      const h = H * scale;
      return { x: L, y: B - h, width: w, height: h };
    }
    case "sw": {
      const sx = (R - px) / W;
      const sy = (py - T) / H;
      const scale = Math.max(sx, sy, minScaleW, minScaleH);
      const w = W * scale;
      const h = H * scale;
      return { x: R - w, y: T, width: w, height: h };
    }
    case "e":
    case "w": {
      const base = anchoredResize(handle, s, px, py);
      const nh = Math.max(MIN, base.width / ar);
      const ny = T + (H - nh) / 2;
      return { x: base.x, y: ny, width: base.width, height: nh };
    }
    case "n":
    case "s": {
      const base = anchoredResize(handle, s, px, py);
      const nw = Math.max(MIN, base.height * ar);
      const nx = L + (W - nw) / 2;
      return { x: nx, y: base.y, width: nw, height: base.height };
    }
    default:
      return anchoredResize(handle, s, px, py);
  }
}

/** Half-extent from center along the dragged edge (signed so shrink follows the pointer). */
function altHalfFromCenter(
  handle: ResizeHandle,
  cx: number,
  cy: number,
  px: number,
  py: number,
): number {
  switch (handle) {
    case "e":
      return Math.max(MIN / 2, px - cx);
    case "w":
      return Math.max(MIN / 2, cx - px);
    case "s":
      return Math.max(MIN / 2, py - cy);
    case "n":
      return Math.max(MIN / 2, cy - py);
    default:
      return MIN / 2;
  }
}

function altCenterResize(handle: ResizeHandle, s: Bounds, px: number, py: number): Bounds {
  const L = s.x;
  const T = s.y;
  const W = s.width;
  const H = s.height;
  const cx = L + W / 2;
  const cy = T + H / 2;

  const symWH = (): Bounds => {
    const halfW = Math.max(MIN / 2, Math.abs(px - cx));
    const halfH = Math.max(MIN / 2, Math.abs(py - cy));
    const w = 2 * halfW;
    const h = 2 * halfH;
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
  };

  switch (handle) {
    case "e":
    case "w": {
      const halfW = altHalfFromCenter(handle, cx, cy, px, py);
      const w = 2 * halfW;
      return { x: cx - w / 2, y: T, width: w, height: H };
    }
    case "n":
    case "s": {
      const halfH = altHalfFromCenter(handle, cx, cy, px, py);
      const h = 2 * halfH;
      return { x: L, y: cy - h / 2, width: W, height: h };
    }
    case "nw":
    case "ne":
    case "se":
    case "sw":
      return symWH();
  }
}

/**
 * Uniform scale from world center using pointer distance ratio (Figma-smooth for Shift+Option).
 */
export function centerProportionalScaleFromWorld(
  startBounds: Bounds,
  centerWorld: { x: number; y: number },
  startPointerWorld: { x: number; y: number },
  currentPointerWorld: { x: number; y: number },
): Bounds {
  const d0 = Math.hypot(
    startPointerWorld.x - centerWorld.x,
    startPointerWorld.y - centerWorld.y,
  );
  const d1 = Math.hypot(
    currentPointerWorld.x - centerWorld.x,
    currentPointerWorld.y - centerWorld.y,
  );
  const minT = Math.max(MIN / startBounds.width, MIN / startBounds.height);
  const t = d0 < 1e-6 ? 1 : Math.max(minT, d1 / d0);
  const w = startBounds.width * t;
  const h = startBounds.height * t;
  const cx = startBounds.x + startBounds.width / 2;
  const cy = startBounds.y + startBounds.height / 2;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

function altShiftCenterResize(handle: ResizeHandle, s: Bounds, px: number, py: number): Bounds {
  const L = s.x;
  const T = s.y;
  const W = s.width;
  const H = s.height;
  const cx = L + W / 2;
  const cy = T + H / 2;
  const t = Math.max(MIN / W, MIN / H, (2 * Math.abs(px - cx)) / W, (2 * Math.abs(py - cy)) / H);
  const w = W * t;
  const h = H * t;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

function shiftAltEdgeResize(handle: ResizeHandle, s: Bounds, px: number, py: number): Bounds {
  const L = s.x;
  const T = s.y;
  const W = s.width;
  const H = s.height;
  const cx = L + W / 2;
  const cy = T + H / 2;
  const ar = W / H;

  switch (handle) {
    case "e":
    case "w": {
      const halfW = altHalfFromCenter(handle, cx, cy, px, py);
      let w = Math.max(MIN, 2 * halfW);
      let h = Math.max(MIN, w / ar);
      w = Math.max(MIN, h * ar);
      return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    }
    case "n":
    case "s": {
      const halfH = altHalfFromCenter(handle, cx, cy, px, py);
      let h = Math.max(MIN, 2 * halfH);
      let w = Math.max(MIN, h * ar);
      h = Math.max(MIN, w / ar);
      return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    }
    default:
      return altShiftCenterResize(handle, s, px, py);
  }
}

function normalizeLineBounds(handle: ResizeHandle, start: Bounds, raw: Bounds): Bounds {
  const hh = start.height;
  const R0 = start.x + start.width;
  const B0 = start.y + start.height;

  if (handle === "e" || handle === "w") {
    return { x: raw.x, y: start.y, width: raw.width, height: hh };
  }
  if (handle === "n") {
    const y = Math.min(raw.y, B0 - MIN);
    return { x: start.x, y, width: start.width, height: hh };
  }
  if (handle === "s") {
    const y = Math.max(raw.y, start.y);
    return { x: start.x, y, width: start.width, height: hh };
  }
  return { x: raw.x, y: raw.y, width: Math.max(MIN, raw.width), height: hh };
}

/**
 * Computes new axis-aligned bounds for a resize drag in **parent local space**
 * (same space as `EditorNode` x/y/width/height).
 */
export function computeResizedBounds(
  handle: ResizeHandle,
  startBounds: Bounds,
  currentPoint: { x: number; y: number },
  modifiers: ResizeModifiers,
  kind: ResizeKind,
): Bounds {
  const px = currentPoint.x;
  const py = currentPoint.y;
  const { shiftKey, altKey } = modifiers;

  let out: Bounds;

  if (altKey && shiftKey) {
    if (handle === "nw" || handle === "ne" || handle === "se" || handle === "sw") {
      out = altShiftCenterResize(handle, startBounds, px, py);
    } else {
      out = shiftAltEdgeResize(handle, startBounds, px, py);
    }
  } else if (altKey) {
    out = altCenterResize(handle, startBounds, px, py);
  } else if (shiftKey) {
    // Shift alone: one-axis / opposite-side anchored on edges; proportional on corners.
    out = isEdgeHandle(handle)
      ? anchoredResize(handle, startBounds, px, py)
      : shiftAnchoredResize(handle, startBounds, px, py);
  } else {
    out = anchoredResize(handle, startBounds, px, py);
  }

  if (kind === "line" || kind === "arrow") {
    out = normalizeLineBounds(handle, startBounds, out);
  }

  return out;
}
