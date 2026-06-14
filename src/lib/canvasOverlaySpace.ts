import { worldToViewport } from "@/lib/canvasCoordinates";
import { screenPxToWorld } from "@/lib/canvasVisual";
import type { Matrix2D } from "@/lib/transformMath";
import { matrixToCssTransform } from "@/lib/transformMath";

export type OverlaySpace = {
  /** When true, overlays use viewport pixels (crisp at any zoom). */
  screenSpace: boolean;
  pan: { x: number; y: number };
  zoom: number;
};

export function snapOverlayPx(v: number): number {
  return Math.round(v);
}

export function worldPointToOverlay(
  worldX: number,
  worldY: number,
  space: OverlaySpace,
): { x: number; y: number } {
  if (!space.screenSpace) return { x: worldX, y: worldY };
  const p = worldToViewport(worldX, worldY, space.pan, space.zoom);
  return { x: snapOverlayPx(p.x), y: snapOverlayPx(p.y) };
}

export function worldLengthToOverlay(len: number, space: OverlaySpace): number {
  if (!space.screenSpace) return len;
  return len * space.zoom;
}

export function screenPxToOverlay(px: number, space: OverlaySpace): number {
  if (!space.screenSpace) return screenPxToWorld(px, space.zoom);
  return px;
}

export function worldRectToOverlay(
  rect: { x: number; y: number; width: number; height: number },
  space: OverlaySpace,
): { x: number; y: number; width: number; height: number } {
  if (!space.screenSpace) return rect;
  const tl = worldPointToOverlay(rect.x, rect.y, space);
  return {
    x: tl.x,
    y: tl.y,
    width: snapOverlayPx(rect.width * space.zoom),
    height: snapOverlayPx(rect.height * space.zoom),
  };
}

export function orientedBoxOverlayStyle(
  worldMatrix: Matrix2D,
  localWidth: number,
  localHeight: number,
  space: OverlaySpace,
  dragOffset: { dx: number; dy: number },
): {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
  transformOrigin: string;
} {
  if (!space.screenSpace) {
    const drag =
      dragOffset.dx === 0 && dragOffset.dy === 0
        ? matrixToCssTransform(worldMatrix)
        : `translate(${dragOffset.dx}px, ${dragOffset.dy}px) ${matrixToCssTransform(worldMatrix)}`;
    return {
      left: 0,
      top: 0,
      width: localWidth,
      height: localHeight,
      transform: drag,
      transformOrigin: "0 0",
    };
  }

  const z = space.zoom;
  const ox = worldMatrix.e + dragOffset.dx;
  const oy = worldMatrix.f + dragOffset.dy;
  const origin = worldPointToOverlay(ox, oy, space);
  return {
    left: 0,
    top: 0,
    width: localWidth,
    height: localHeight,
    transform: `translate(${origin.x}px, ${origin.y}px) matrix(${worldMatrix.a * z}, ${worldMatrix.b * z}, ${worldMatrix.c * z}, ${worldMatrix.d * z}, 0, 0)`,
    transformOrigin: "0 0",
  };
}

/** Zoom passed to rotate-zone helpers (screen px when screenSpace). */
export function overlayZoomForRotateHelpers(space: OverlaySpace): number {
  return space.screenSpace ? 1 : space.zoom;
}
