import type { PathPoint } from "@/lib/pathGeometry";
import { polygonPathPoints } from "@/lib/shapes/polygonGeometry";
import { starPathPoints } from "@/lib/shapes/starGeometry";

/** Regular polygon centered in a w×h box. */
export function generatePolygonPoints(sides: number, width: number, height: number): PathPoint[] {
  return polygonPathPoints(sides, width, height);
}

/** Star with outer/inner radii as fractions of the box (Figma-style). */
export function generateStarPoints(
  numPoints: number,
  innerRadius: number,
  width: number,
  height: number,
): PathPoint[] {
  return starPathPoints(numPoints, innerRadius, width, height);
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
