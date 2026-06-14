import { starVertices } from "@/lib/shapes/starGeometry";
import type { Point2 } from "./roundedCornerUtils";

export type StarShapeInput = {
  width: number;
  height: number;
  points: number;
  ratio: number;
};

/** Sharp star vertices (2 × point count), top spike at 12 o'clock. */
export function generateStarPoints(shape: StarShapeInput): Point2[] {
  return starVertices(shape.points, shape.ratio, shape.width, shape.height);
}
