import { polygonVertices } from "@/lib/shapes/polygonGeometry";
import type { Point2 } from "./roundedCornerUtils";

export type PolygonShapeInput = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  sides: number;
};

/** Regular polygon vertices in local box space (first vertex at top). */
export function generatePolygonPoints(shape: PolygonShapeInput): Point2[] {
  return polygonVertices(shape.sides, shape.width, shape.height);
}
