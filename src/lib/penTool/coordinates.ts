import { clientToWorld, viewportToWorld, type PanZoom } from "@/lib/canvasCoordinates";
import { screenPxToWorld } from "@/lib/canvasVisual";
import type { OverlaySpace } from "@/lib/canvasOverlaySpace";
import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import type { PathPoint } from "@/lib/pathGeometry";
import {
  PEN_CLOSE_HIT_RADIUS,
  PEN_CURVE_DRAG_THRESHOLD,
} from "./types";

export const PEN_CLOSE_HIT_RADIUS_SCREEN = PEN_CLOSE_HIT_RADIUS;
export const PEN_HIT_TARGET_SCREEN_PX = 16;

/** World-space hit radius from screen pixels (zoom-aware). */
export function penHitRadiusWorld(zoom: number, screenPx = PEN_HIT_TARGET_SCREEN_PX): number {
  return screenPxToWorld(screenPx, zoom);
}

/** World-space close-path snap radius from screen pixels. */
export function penCloseHitRadiusWorld(zoom: number, screenPx = PEN_CLOSE_HIT_RADIUS_SCREEN): number {
  return screenPxToWorld(screenPx, zoom);
}

export function penCurveDragThresholdWorld(zoom: number, screenPx = PEN_CURVE_DRAG_THRESHOLD): number {
  return screenPxToWorld(screenPx, zoom);
}

/** Client pointer → world using the same pan/zoom as the rendered scene. */
export function penPointerToWorld(
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement | null,
  panZoom: PanZoom,
): { x: number; y: number } {
  return clientToWorld(clientX, clientY, viewportEl, panZoom);
}

/** Viewport-local pointer → world (for tests). */
export function penViewportToWorld(
  vx: number,
  vy: number,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return viewportToWorld(vx, vy, pan, zoom);
}

export type WorldPathPoint = {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
};

export function pathPointsToWorldPoints(
  points: readonly PathPoint[],
  origin: { x: number; y: number },
): WorldPathPoint[] {
  return points.map((p) => ({
    x: origin.x + p.x,
    y: origin.y + p.y,
    handleIn: p.handleIn,
    handleOut: p.handleOut,
  }));
}

export function worldPointToOverlayPoint(
  worldX: number,
  worldY: number,
  overlay: OverlaySpace,
): { x: number; y: number } {
  return worldPointToOverlay(worldX, worldY, overlay);
}
