import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";

export type StrokeSidesMode = "all" | "top" | "bottom" | "left" | "right" | "custom";

export type StrokeSidesCustom = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
};

export type ResolvedStrokeSides = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type StrokeEdgeRect = { x: number; y: number; width: number; height: number };

export function supportsStrokeSides(node: Pick<EditorNode, "type">): boolean {
  return node.type === "rectangle" || node.type === "frame";
}

export function resolveStrokeSides(
  node: Pick<EditorNode, "strokeSides" | "strokeSidesCustom">,
): ResolvedStrokeSides {
  const mode = node.strokeSides ?? "all";
  if (mode === "top") return { top: true, right: false, bottom: false, left: false };
  if (mode === "bottom") return { top: false, right: false, bottom: true, left: false };
  if (mode === "left") return { top: false, right: false, bottom: false, left: true };
  if (mode === "right") return { top: false, right: true, bottom: false, left: false };
  if (mode === "custom") {
    const c = node.strokeSidesCustom ?? {};
    return {
      top: c.top !== false,
      right: c.right !== false,
      bottom: c.bottom !== false,
      left: c.left !== false,
    };
  }
  return { top: true, right: true, bottom: true, left: true };
}

export function usesPerEdgeStroke(
  node: Pick<EditorNode, "type" | "strokeSides" | "strokePosition">,
): boolean {
  if (!supportsStrokeSides(node)) return false;
  const sides = resolveStrokeSides(node);
  const allSides = sides.top && sides.right && sides.bottom && sides.left;
  const position = node.strokePosition ?? "center";
  return !allSides || position !== "center";
}

export function strokeEdgeRects(
  width: number,
  height: number,
  strokeWidth: number,
  position: StrokePosition,
  sides: ResolvedStrokeSides,
): StrokeEdgeRect[] {
  const sw = Math.max(0, strokeWidth);
  if (sw <= 0) return [];
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const rects: StrokeEdgeRect[] = [];

  if (sides.top) {
    if (position === "inside") rects.push({ x: 0, y: 0, width: w, height: sw });
    else if (position === "outside") rects.push({ x: 0, y: -sw, width: w, height: sw });
    else rects.push({ x: 0, y: -sw / 2, width: w, height: sw });
  }
  if (sides.bottom) {
    if (position === "inside") rects.push({ x: 0, y: h - sw, width: w, height: sw });
    else if (position === "outside") rects.push({ x: 0, y: h, width: w, height: sw });
    else rects.push({ x: 0, y: h - sw / 2, width: w, height: sw });
  }
  if (sides.left) {
    if (position === "inside") rects.push({ x: 0, y: 0, width: sw, height: h });
    else if (position === "outside") rects.push({ x: -sw, y: 0, width: sw, height: h });
    else rects.push({ x: -sw / 2, y: 0, width: sw, height: h });
  }
  if (sides.right) {
    if (position === "inside") rects.push({ x: w - sw, y: 0, width: sw, height: h });
    else if (position === "outside") rects.push({ x: w, y: 0, width: sw, height: h });
    else rects.push({ x: w - sw / 2, y: 0, width: sw, height: h });
  }
  return rects;
}

/** Use clip/layer technique for inside/outside on closed paths (not per-edge rects). */
export function shouldUseAlignedPathStroke(
  node: Pick<EditorNode, "type" | "strokeSides" | "strokePosition">,
  closed: boolean,
): boolean {
  if (!closed) return false;
  if (usesPerEdgeStroke(node)) return false;
  return (node.strokePosition ?? "center") !== "center";
}

export function fullEllipsePathD(width: number, height: number): string {
  const rx = Math.max(0, width) / 2;
  const ry = Math.max(0, height) / 2;
  const cx = rx;
  const cy = ry;
  const h = Math.max(0, height);
  return `M ${cx} 0 A ${rx} ${ry} 0 1 1 ${cx} ${h} A ${rx} ${ry} 0 1 1 ${cx} 0 Z`;
}

/** CSS border sides for HTML/React export (rectangles / frames). */
export function strokeSidesToReactStyle(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeWidth"
    | "strokeColor"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
  >,
): Record<string, string> {
  const sw = node.strokeWidth ?? 0;
  if (sw <= 0 || node.strokeEnabled === false || !node.strokeColor) return {};
  if (!usesPerEdgeStroke(node)) {
    const pos = node.strokePosition ?? "center";
    if (pos === "center") {
      return { border: `${sw}px solid ${node.strokeColor}` };
    }
    return {};
  }
  const sides = resolveStrokeSides(node);
  const color = node.strokeColor;
  const style: Record<string, string> = { boxSizing: "border-box" };
  if (sides.top) style.borderTop = `${sw}px solid ${color}`;
  if (sides.right) style.borderRight = `${sw}px solid ${color}`;
  if (sides.bottom) style.borderBottom = `${sw}px solid ${color}`;
  if (sides.left) style.borderLeft = `${sw}px solid ${color}`;
  return style;
}

export function alignedPathStrokeWidth(
  position: StrokePosition,
  strokeWidth: number,
): number {
  const sw = Math.max(0, strokeWidth);
  const pos = position ?? "center";
  if (pos === "inside" || pos === "outside") return sw * 2;
  return sw;
}
