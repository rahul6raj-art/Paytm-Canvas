import type { Point2 } from "./roundedCornerUtils";

/** Scale vertices so their axis-aligned bounds match (0,0,width,height) — Figma polygon parity. */
export function fitVerticesToBoundingBox(
  vertices: Point2[],
  width: number,
  height: number,
): Point2[] {
  if (vertices.length === 0) return vertices;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of vertices) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX < 1e-6 || spanY < 1e-6) return vertices;
  return vertices.map((p) => ({
    x: ((p.x - minX) / spanX) * width,
    y: ((p.y - minY) / spanY) * height,
  }));
}
