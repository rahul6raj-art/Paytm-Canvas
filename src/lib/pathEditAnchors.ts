import { screenPxToWorld } from "@/lib/canvasVisual";
import { screenPxToOverlay, type OverlaySpace } from "@/lib/canvasOverlaySpace";
import type { PathPoint } from "@/lib/pathGeometry";

/** Figma-style vector edit anchor diameter (screen px). */
export const PATH_EDIT_ANCHOR_SCREEN_PX = 6;

/** Selected anchor diameter (screen px). */
export const PATH_EDIT_ANCHOR_SELECTED_SCREEN_PX = 8;

/** Bezier tangent handle diameter (screen px). */
export const PATH_EDIT_BEZIER_HANDLE_SCREEN_PX = 5;

/** Minimum pointer target for anchors/handles (screen px). */
export const PATH_EDIT_HIT_TARGET_SCREEN_PX = 14;

const PATH_EDIT_ANCHOR_FILL = "#18a0fb";
const PATH_EDIT_ANCHOR_SELECTED_RING = "#ffffff";

export function pathEditAnchorSizePx(selected: boolean): number {
  return selected ? PATH_EDIT_ANCHOR_SELECTED_SCREEN_PX : PATH_EDIT_ANCHOR_SCREEN_PX;
}

export function pathEditAnchorLocalSize(zoom: number, selected: boolean): number {
  return screenPxToWorld(pathEditAnchorSizePx(selected), zoom);
}

export function pathEditBezierHandleLocalSize(zoom: number): number {
  return screenPxToWorld(PATH_EDIT_BEZIER_HANDLE_SCREEN_PX, zoom);
}

/** Anchor dot style in path-local coordinates (constant screen size). */
export function pathEditAnchorStyle(zoom: number, selected: boolean): React.CSSProperties {
  const size = pathEditAnchorLocalSize(zoom, selected);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: PATH_EDIT_ANCHOR_FILL,
    boxSizing: "border-box",
    transform: "translate(-50%, -50%)",
    border: "none",
    padding: 0,
  };
  if (selected) {
    const ring = screenPxToWorld(1, zoom);
    const glow = screenPxToWorld(4, zoom);
    style.boxShadow = `0 0 0 ${ring}px ${PATH_EDIT_ANCHOR_SELECTED_RING}, 0 0 ${glow}px rgba(24, 160, 251, 0.7)`;
  }
  return style;
}

export function pathEditBezierHandleStyle(zoom: number): React.CSSProperties {
  const size = pathEditBezierHandleLocalSize(zoom);
  return pathEditHandleVisualStyle(size, screenPxToWorld(1, zoom));
}

/** Screen-space anchor/handle styles for viewport overlays (crisp at any zoom). */
export function pathEditAnchorOverlayStyle(
  overlay: OverlaySpace,
  selected: boolean,
): React.CSSProperties {
  const visual = screenPxToOverlay(pathEditAnchorSizePx(selected), overlay);
  const hit = screenPxToOverlay(PATH_EDIT_HIT_TARGET_SCREEN_PX, overlay);
  const style: React.CSSProperties = {
    width: hit,
    height: hit,
    borderRadius: "50%",
    background: PATH_EDIT_ANCHOR_FILL,
    boxSizing: "border-box",
    transform: "translate(-50%, -50%)",
    border: "none",
    padding: 0,
    backgroundClip: "content-box",
    borderWidth: (hit - visual) / 2,
    borderStyle: "solid",
    borderColor: "transparent",
  };
  if (selected) {
    const ring = screenPxToOverlay(1, overlay);
    const glow = screenPxToOverlay(4, overlay);
    style.boxShadow = `0 0 0 ${ring}px ${PATH_EDIT_ANCHOR_SELECTED_RING}, 0 0 ${glow}px rgba(24, 160, 251, 0.7)`;
  }
  return style;
}

export function pathEditBezierHandleOverlayStyle(overlay: OverlaySpace): React.CSSProperties {
  const visual = screenPxToOverlay(PATH_EDIT_BEZIER_HANDLE_SCREEN_PX, overlay);
  const hit = screenPxToOverlay(PATH_EDIT_HIT_TARGET_SCREEN_PX, overlay);
  const ring = screenPxToOverlay(1, overlay);
  return {
    width: hit,
    height: hit,
    borderRadius: "50%",
    background: "#ffffff",
    boxSizing: "border-box",
    transform: "translate(-50%, -50%)",
    border: `${ring}px solid ${PATH_EDIT_ANCHOR_FILL}`,
    padding: Math.max(0, (hit - visual - ring * 2) / 2),
    backgroundClip: "content-box",
  };
}

function pathEditHandleVisualStyle(size: number, borderWorld: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    background: "#ffffff",
    boxSizing: "border-box",
    transform: "translate(-50%, -50%)",
    border: `${borderWorld}px solid ${PATH_EDIT_ANCHOR_FILL}`,
    padding: 0,
  };
}

export function togglePathPointInSelection(
  current: readonly string[],
  pointId: string,
  additive: boolean,
): string[] {
  if (!additive) return [pointId];
  if (current.includes(pointId)) return current.filter((id) => id !== pointId);
  return [...current, pointId];
}

export function selectedPathPoints(
  pathPoints: PathPoint[] | undefined,
  selectedIds: readonly string[],
): PathPoint[] {
  if (!pathPoints?.length || !selectedIds.length) return [];
  const set = new Set(selectedIds);
  return pathPoints.filter((p) => set.has(p.id));
}

export function pathPointSelectionPosition(
  pathPoints: PathPoint[] | undefined,
  selectedIds: readonly string[],
): { x: number; y: number; mixed: boolean } | null {
  const pts = selectedPathPoints(pathPoints, selectedIds);
  if (pts.length === 0) return null;
  const x0 = pts[0]!.x;
  const y0 = pts[0]!.y;
  const mixed = pts.some((p) => p.x !== x0 || p.y !== y0);
  if (pts.length === 1) return { x: x0, y: y0, mixed: false };
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x, y, mixed };
}
