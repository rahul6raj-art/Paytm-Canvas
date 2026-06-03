import { newPathPointId, type PathPoint } from "@/lib/pathGeometry";

/** Regular polygon centered in a w×h box. */
export function generatePolygonPoints(sides: number, width: number, height: number): PathPoint[] {
  const n = Math.max(3, Math.min(64, Math.round(sides)));
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const pts: PathPoint[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    pts.push({
      id: newPathPointId(),
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return pts;
}

/** Star with outer/inner radii as fractions of the box. */
export function generateStarPoints(
  numPoints: number,
  innerRadius: number,
  width: number,
  height: number,
): PathPoint[] {
  const spikes = Math.max(3, Math.min(32, Math.round(numPoints)));
  const cx = width / 2;
  const cy = height / 2;
  const outerRx = width / 2;
  const outerRy = height / 2;
  const innerRx = outerRx * innerRadius;
  const innerRy = outerRy * innerRadius;
  const total = spikes * 2;
  const pts: PathPoint[] = [];
  for (let i = 0; i < total; i++) {
    const angle = (-Math.PI / 2) + (i * Math.PI) / spikes;
    const outer = i % 2 === 0;
    const rx = outer ? outerRx : innerRx;
    const ry = outer ? outerRy : innerRy;
    pts.push({
      id: newPathPointId(),
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return pts;
}

/** Arrow as open path: shaft + arrowhead. */
export function generateArrowPoints(width: number, height: number): PathPoint[] {
  const y = height / 2;
  const head = Math.min(width * 0.25, height * 1.5, 24);
  const shaftEnd = Math.max(head + 4, width - head);
  return [
    { id: newPathPointId(), x: 0, y },
    { id: newPathPointId(), x: shaftEnd, y },
    { id: newPathPointId(), x: shaftEnd, y: y - head / 2 },
    { id: newPathPointId(), x: width, y },
    { id: newPathPointId(), x: shaftEnd, y: y + head / 2 },
    { id: newPathPointId(), x: shaftEnd, y },
  ];
}

/** Triangle (3-sided polygon). */
export function generateTrianglePoints(width: number, height: number): PathPoint[] {
  return generatePolygonPoints(3, width, height);
}
