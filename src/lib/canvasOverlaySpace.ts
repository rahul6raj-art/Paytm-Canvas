import { worldToViewport } from "@/lib/canvasCoordinates";
import { snapScreenToDevicePixel } from "@/lib/crispRender";
import { screenPxToWorld } from "@/lib/canvasVisual";
import type { Matrix2D } from "@/lib/transformMath";
import { matrixToCssTransform } from "@/lib/transformMath";

export type OverlaySpace = {
  /** When true, overlays use viewport pixels (crisp at any zoom). */
  screenSpace: boolean;
  pan: { x: number; y: number };
  zoom: number;
};

function overlayDpr(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

/** Snap overlay coordinates to the device pixel grid (Figma-style crisp chrome). */
export function snapOverlayPx(v: number): number {
  return snapScreenToDevicePixel(v, overlayDpr());
}

/** Axis-aligned 1px stroke rect inset so hairlines land on device pixels. */
export function crispOverlayHairlineRect(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const x = snapOverlayPx(rect.x);
  const y = snapOverlayPx(rect.y);
  const right = snapOverlayPx(rect.x + rect.width);
  const bottom = snapOverlayPx(rect.y + rect.height);
  return {
    x: x + 0.5,
    y: y + 0.5,
    width: Math.max(0, right - x - 1),
    height: Math.max(0, bottom - y - 1),
  };
}

export function worldPointToOverlay(
  worldX: number,
  worldY: number,
  space: OverlaySpace,
): { x: number; y: number } {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    return { x: 0, y: 0 };
  }
  if (!space.screenSpace) return { x: worldX, y: worldY };
  if (
    !Number.isFinite(space.zoom) ||
    space.zoom <= 0 ||
    !Number.isFinite(space.pan.x) ||
    !Number.isFinite(space.pan.y)
  ) {
    return { x: 0, y: 0 };
  }
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
  const br = worldPointToOverlay(rect.x + rect.width, rect.y + rect.height, space);
  return {
    x: tl.x,
    y: tl.y,
    width: Math.max(0, br.x - tl.x),
    height: Math.max(0, br.y - tl.y),
  };
}

export type OrientedBoxOverlayStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
  transformOrigin: string;
  /** Canvas/raster overlays: render at this scale instead of CSS-zooming a tiny bitmap. */
  contentScaleX?: number;
  contentScaleY?: number;
};

export type OrientedBoxOverlayOptions = {
  /**
   * Size the overlay box in viewport pixels and keep zoom out of the CSS matrix.
   * Use for canvas text — scaling a small canvas via transform can disappear at high zoom.
   */
  contentAtScreenSize?: boolean;
};

export function orientedBoxOverlayStyle(
  worldMatrix: Matrix2D,
  localWidth: number,
  localHeight: number,
  space: OverlaySpace,
  dragOffset: { dx: number; dy: number },
  options?: OrientedBoxOverlayOptions,
): OrientedBoxOverlayStyle {
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
  const scaleX = Math.hypot(worldMatrix.a, worldMatrix.b) || 1;
  const scaleY = Math.hypot(worldMatrix.c, worldMatrix.d) || 1;

  if (options?.contentAtScreenSize) {
    return {
      left: 0,
      top: 0,
      width: localWidth * scaleX * z,
      height: localHeight * scaleY * z,
      transform: `translate(${origin.x}px, ${origin.y}px) matrix(${worldMatrix.a}, ${worldMatrix.b}, ${worldMatrix.c}, ${worldMatrix.d}, 0, 0)`,
      transformOrigin: "0 0",
      contentScaleX: scaleX * z,
      contentScaleY: scaleY * z,
    };
  }

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
