import type { GradientHandle, GradientHandles, GradientKind } from "./types";

/** Figma REST API default handle positions per kind. */
export const FIGMA_DEFAULT_HANDLES: Record<GradientKind, GradientHandles> = {
  linear: [
    { x: 0, y: 0.5 },
    { x: 1, y: 0.5 },
    { x: 1, y: 0 },
  ],
  radial: [
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 1, y: 0.5 },
  ],
  angular: [
    { x: 0.5, y: 0.5 },
    { x: 1, y: 0.5 },
    { x: 0.5, y: 1 },
  ],
  diamond: [
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 1, y: 0.5 },
  ],
};

export function defaultHandlesForKind(kind: GradientKind): GradientHandles {
  return FIGMA_DEFAULT_HANDLES[kind].map((h) => ({ ...h })) as GradientHandles;
}

export function clampHandle(h: GradientHandle): GradientHandle {
  return { x: Math.max(0, Math.min(1, h.x)), y: Math.max(0, Math.min(1, h.y)) };
}

export function handlesToPixel(
  handles: GradientHandles,
  width: number,
  height: number,
): GradientHandles {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return handles.map((hn) => ({ x: hn.x * w, y: hn.y * h })) as GradientHandles;
}

export function linearGradientT(
  localX: number,
  localY: number,
  handles: GradientHandles,
): number {
  const [h0, h1] = handles;
  const dx = h1.x - h0.x;
  const dy = h1.y - h0.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) return localX;
  const t = ((localX - h0.x) * dx + (localY - h0.y) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

export function radialGradientT(
  localX: number,
  localY: number,
  handles: GradientHandles,
): number {
  const [center, edge] = handles;
  const dx = localX - center.x;
  const dy = localY - center.y;
  const dist = Math.hypot(dx, dy);
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
  if (radius <= 1e-6) return 0;
  return Math.min(1, dist / radius);
}

export function angularGradientT(
  localX: number,
  localY: number,
  handles: GradientHandles,
): number {
  const [center, ref] = handles;
  const angle = Math.atan2(localY - center.y, localX - center.x);
  const refAngle = Math.atan2(ref.y - center.y, ref.x - center.x);
  let delta = angle - refAngle;
  while (delta < 0) delta += Math.PI * 2;
  while (delta >= Math.PI * 2) delta -= Math.PI * 2;
  return delta / (Math.PI * 2);
}

export function diamondGradientT(
  localX: number,
  localY: number,
  handles: GradientHandles,
): number {
  const [center, edge, widthRef] = handles;
  const dx = Math.abs(localX - center.x);
  const dy = Math.abs(localY - center.y);
  const rx = Math.max(1e-6, Math.abs(widthRef.x - center.x));
  const ry = Math.max(1e-6, Math.abs(edge.y - center.y));
  return Math.min(1, dx / rx + dy / ry);
}

export function gradientTAtLocal(
  kind: GradientKind,
  localX: number,
  localY: number,
  handles: GradientHandles,
): number {
  switch (kind) {
    case "linear":
      return linearGradientT(localX, localY, handles);
    case "radial":
      return radialGradientT(localX, localY, handles);
    case "angular":
      return angularGradientT(localX, localY, handles);
    case "diamond":
      return diamondGradientT(localX, localY, handles);
    default:
      return localX;
  }
}

/** Map stop position (0–100) to a point on the linear axis (for canvas handles). */
export function stopPointOnLinearAxis(
  position: number,
  handles: GradientHandles,
  width: number,
  height: number,
): { x: number; y: number } {
  const [h0, h1] = handles;
  const t = position / 100;
  const lx = h0.x + (h1.x - h0.x) * t;
  const ly = h0.y + (h1.y - h0.y) * t;
  return { x: lx * width, y: ly * height };
}

export function positionFromLinearAxisPoint(
  px: number,
  py: number,
  handles: GradientHandles,
  width: number,
  height: number,
): number {
  const lx = px / Math.max(1, width);
  const ly = py / Math.max(1, height);
  const t = linearGradientT(lx, ly, handles);
  return Math.round(t * 1000) / 10;
}

/** Offset a screen-space point perpendicular to the gradient axis (for stop swatches). */
export function offsetPerpendicularToAxis(
  point: { x: number; y: number },
  axisStart: { x: number; y: number },
  axisEnd: { x: number; y: number },
  offsetPx: number,
): { x: number; y: number } {
  const dx = axisEnd.x - axisStart.x;
  const dy = axisEnd.y - axisStart.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return { x: point.x + offsetPx, y: point.y };
  const px = dy / len;
  const py = -dx / len;
  return { x: point.x + px * offsetPx, y: point.y + py * offsetPx };
}

export function cssLinearAngleDeg(handles: GradientHandles): number {
  const [h0, h1] = handles;
  const dx = h1.x - h0.x;
  const dy = h1.y - h0.y;
  const rad = Math.atan2(dy, dx);
  return ((rad * 180) / Math.PI + 90 + 360) % 360;
}

export function cssConicStartDeg(handles: GradientHandles): number {
  const [center, ref] = handles;
  const rad = Math.atan2(ref.y - center.y, ref.x - center.x);
  return (rad * 180) / Math.PI + 90;
}

/** CSS linear-gradient angle (0° = up) from handle axis. */
export function linearGradientAngleDeg(handles: GradientHandles): number {
  return Math.round(cssLinearAngleDeg(handles));
}

export function setLinearGradientAngle(handles: GradientHandles, angleDeg: number): GradientHandles {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const next = handles.map((h) => ({ ...h })) as GradientHandles;
  next[0] = { x: 0.5 - Math.cos(rad) * 0.5, y: 0.5 - Math.sin(rad) * 0.5 };
  next[1] = { x: 0.5 + Math.cos(rad) * 0.5, y: 0.5 + Math.sin(rad) * 0.5 };
  return next;
}

/** Set angular/conic gradient start angle via the reference handle. */
export function setAngularGradientRefAngle(handles: GradientHandles, angleDeg: number): GradientHandles {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const next = handles.map((h) => ({ ...h })) as GradientHandles;
  const center = next[0]!;
  next[1] = {
    x: center.x + Math.cos(rad) * 0.5,
    y: center.y + Math.sin(rad) * 0.5,
  };
  return next;
}
