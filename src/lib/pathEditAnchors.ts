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
export const PATH_EDIT_HIT_TARGET_SCREEN_PX = 16;

const PATH_EDIT_ANCHOR_STROKE = "#18a0fb";
const PATH_EDIT_ANCHOR_FILL_UNSELECTED = "#ffffff";
const PATH_EDIT_ANCHOR_FILL_SELECTED = "#18a0fb";
/** Figma-style tangent arm (handles appear only for the selected anchor). */
export const PATH_EDIT_HANDLE_LINE_STROKE = "#b3b3b3";

export function pathEditAnchorSizePx(selected: boolean): number {
  return selected ? PATH_EDIT_ANCHOR_SELECTED_SCREEN_PX : PATH_EDIT_ANCHOR_SCREEN_PX;
}

export function pathEditAnchorLocalSize(zoom: number, selected: boolean): number {
  return screenPxToWorld(pathEditAnchorSizePx(selected), zoom);
}

export function pathEditBezierHandleLocalSize(zoom: number): number {
  return screenPxToWorld(PATH_EDIT_BEZIER_HANDLE_SCREEN_PX, zoom);
}

/** True when exactly one path anchor is selected — Figma shows Bézier arms only then. */
export function pathPointForBezierHandleDisplay(
  pathPoints: PathPoint[] | undefined,
  selectedIds: readonly string[],
  opts?: { roundedRect?: boolean },
): PathPoint | null {
  if (opts?.roundedRect) return null;
  const selected = selectedPathPoints(pathPoints, selectedIds);
  return selected.length === 1 ? (selected[0] ?? null) : null;
}

export function pathEditAnchorStyle(zoom: number, selected: boolean): React.CSSProperties {
  const size = pathEditAnchorLocalSize(zoom, selected);
  const border = screenPxToWorld(1, zoom);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    backgroundColor: selected ? PATH_EDIT_ANCHOR_FILL_SELECTED : PATH_EDIT_ANCHOR_FILL_UNSELECTED,
    boxSizing: "border-box",
    transform: "translate(-50%, -50%)",
    padding: 0,
    border: selected ? "none" : `${border}px solid ${PATH_EDIT_ANCHOR_STROKE}`,
  };
  if (selected) {
    const ring = screenPxToWorld(1, zoom);
    const glow = screenPxToWorld(4, zoom);
    style.boxShadow = `0 0 0 ${ring}px #ffffff, 0 0 ${glow}px rgba(24, 160, 251, 0.7)`;
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
  const ring = screenPxToOverlay(1, overlay);
  const style: React.CSSProperties = {
    width: hit,
    height: hit,
    borderRadius: "50%",
    backgroundColor: selected ? PATH_EDIT_ANCHOR_FILL_SELECTED : PATH_EDIT_ANCHOR_FILL_UNSELECTED,
    boxSizing: "border-box",
    transform: "translate(-50%, -50%)",
    padding: 0,
    backgroundClip: "content-box",
    borderWidth: (hit - visual) / 2,
    borderStyle: "solid",
    borderColor: "transparent",
  };
  if (selected) {
    const glow = screenPxToOverlay(4, overlay);
    style.boxShadow = `0 0 0 ${ring}px #ffffff, 0 0 ${glow}px rgba(24, 160, 251, 0.7)`;
  } else {
    style.borderColor = PATH_EDIT_ANCHOR_STROKE;
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
    borderRadius: 0,
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    transform: "translate(-50%, -50%) rotate(45deg)",
    border: `${ring}px solid ${PATH_EDIT_ANCHOR_STROKE}`,
    padding: Math.max(0, (hit - visual - ring * 2) / 2),
    backgroundClip: "content-box",
  };
}

function pathEditHandleVisualStyle(size: number, borderWorld: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 0,
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    transform: "translate(-50%, -50%) rotate(45deg)",
    border: `${borderWorld}px solid ${PATH_EDIT_ANCHOR_STROKE}`,
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

export type PathHandleAffordance = {
  kind: "handle-in" | "handle-out";
  vec: { x: number; y: number };
  /** True when the handle is a pull-out affordance (not yet stored on the point). */
  virtual: boolean;
};

/** Handles to render for a selected point (includes pull-out affordances on corner points). */
export function pathPointHandleAffordances(
  pt: PathPoint,
  editable: boolean,
): PathHandleAffordance[] {
  if (!editable) return [];
  const out: PathHandleAffordance[] = [];
  if (pt.handleIn) out.push({ kind: "handle-in", vec: pt.handleIn, virtual: false });
  else out.push({ kind: "handle-in", vec: { x: 0, y: 0 }, virtual: true });

  if (pt.handleOut) out.push({ kind: "handle-out", vec: pt.handleOut, virtual: false });
  else out.push({ kind: "handle-out", vec: { x: 0, y: 0 }, virtual: true });

  return out;
}
