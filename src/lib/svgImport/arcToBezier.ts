/** SVG elliptical arc endpoint → cubic Bézier segments (W3C SVG implementation notes). */

export type CubicBezier = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
};

const TAU = Math.PI * 2;

function modTau(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

/** Convert one SVG arc (A command) into 1+ cubic Bézier segments. */
export function svgArcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): CubicBezier[] {
  if (x1 === x2 && y1 === y2) return [];
  if (rx === 0 || ry === 0) {
    return [{ x1, y1, x2, y2, x: x2, y: y2 }];
  }

  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  const den = rxSq * y1pSq + rySq * x1pSq;
  const coef = den === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (coef * -ry * x1p) / rx;

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const unitVector = (ux: number, uy: number) => {
    const len = Math.hypot(ux, uy);
    return len === 0 ? { x: 0, y: 0 } : { x: ux / len, y: uy / len };
  };

  const angleBetween = (ux: number, uy: number, vx: number, vy: number) => {
    const u = unitVector(ux, uy);
    const v = unitVector(vx, vy);
    const dot = Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y));
    let ang = Math.acos(dot);
    if (u.x * v.y - u.y * v.x < 0) ang = -ang;
    return ang;
  };

  const v1x = (x1p - cxp) / rx;
  const v1y = (y1p - cyp) / ry;
  const v2x = (-x1p - cxp) / rx;
  const v2y = (-y1p - cyp) / ry;

  let theta1 = angleBetween(1, 0, v1x, v1y);
  let delta = angleBetween(v1x, v1y, v2x, v2y);
  if (!sweep && delta > 0) delta -= TAU;
  if (sweep && delta < 0) delta += TAU;

  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const deltaSeg = delta / segments;
  const out: CubicBezier[] = [];
  let px = x1;
  let py = y1;

  for (let i = 0; i < segments; i++) {
    const t1 = theta1 + i * deltaSeg;
    const t2 = t1 + deltaSeg;
    const alpha = (4 / 3) * Math.tan(deltaSeg / 4);

    const cosT1 = Math.cos(t1);
    const sinT1 = Math.sin(t1);
    const cosT2 = Math.cos(t2);
    const sinT2 = Math.sin(t2);

    const ex1 = rx * cosT1;
    const ey1 = ry * sinT1;
    const ex2 = rx * cosT2;
    const ey2 = ry * sinT2;

    const x = cosPhi * ex2 - sinPhi * ey2 + cx;
    const y = sinPhi * ex2 + cosPhi * ey2 + cy;

    const c1x = cosPhi * (ex1 - alpha * rx * sinT1) - sinPhi * (ey1 + alpha * ry * cosT1) + cx;
    const c1y = sinPhi * (ex1 - alpha * rx * sinT1) + cosPhi * (ey1 + alpha * ry * cosT1) + cy;
    const c2x = cosPhi * (ex2 + alpha * rx * sinT2) - sinPhi * (ey2 - alpha * ry * cosT2) + cx;
    const c2y = sinPhi * (ex2 + alpha * rx * sinT2) + cosPhi * (ey2 - alpha * ry * cosT2) + cy;

    out.push({ x1: c1x, y1: c1y, x2: c2x, y2: c2y, x, y });
    px = x;
    py = y;
  }

  if (out.length > 0) {
    const last = out[out.length - 1]!;
    last.x = x2;
    last.y = y2;
  }

  return out;
}
