import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import {
  boundsFromDrag,
  type Point,
  type ShapeDragPhase,
  type ShapeModifiers,
} from "@/lib/shapes/shapeCreation";
import { computeTextBoxSize } from "@/lib/text/textLayout";
import { MIN_TEXT_BOX, textResizePatch, type TextResizeMode } from "@/lib/text/textNodeModel";

export type TextStyleSeed = Partial<
  Pick<
    EditorNode,
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "letterSpacing"
    | "textColor"
    | "fill"
    | "textAlign"
    | "verticalAlign"
    | "opacity"
  >
>;

function minTextSizeForPhase(phase: ShapeDragPhase): number {
  return phase === "live" ? 0 : MIN_TEXT_BOX;
}

/** Geometry patch while live-dragging a new text box. */
export function textGeometryPatchFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  phase: ShapeDragPhase = "commit",
): Pick<EditorNode, "x" | "y" | "width" | "height"> {
  const minSize = minTextSizeForPhase(phase);
  const box = boundsFromDrag(start, end, modifiers, { minSize });
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.max(minSize, Math.round(box.width)),
    height: Math.max(minSize, Math.round(box.height)),
  };
}

/** Build a new text node (caller assigns id/parent and inserts). */
export function createTextNode(
  x: number,
  y: number,
  width: number,
  height: number,
  mode: TextResizeMode,
  style?: TextStyleSeed,
  phase: ShapeDragPhase = "commit",
): Omit<EditorNode, "id" | "parentId"> {
  const typo = resolveTextTypo(style ?? {});
  const liveZero = phase === "live" && width <= 0 && height <= 0;
  const size = liveZero
    ? { width: 0, height: 0 }
    : computeTextBoxSize("", typo, mode, width, height);
  const boxW = liveZero ? 0 : mode === "auto-width" ? size.width : Math.max(MIN_TEXT_BOX, width);
  const boxH = liveZero ? 0 : Math.max(MIN_TEXT_BOX, size.height);
  return {
    type: "text",
    name: "Text",
    x,
    y,
    width: boxW,
    height: boxH,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "",
    ...textResizePatch(mode),
    textAlign: style?.textAlign ?? "left",
    verticalAlign: style?.verticalAlign ?? "top",
    fillEnabled: true,
    fillOpacity: 1,
    opacity: style?.opacity ?? 1,
    ...style,
    fontFamily: typo.fontFamily,
    fontSize: typo.fontSize,
    fontWeight: typo.fontWeight,
    lineHeight: typo.lineHeight,
    letterSpacing: typo.letterSpacing,
    textColor: style?.textColor ?? typo.color,
    fill: style?.fill ?? typo.color,
  };
}

/** Point text at world top-left (auto width). */
export function createPointTextAt(
  worldX: number,
  worldY: number,
  boxWidth: number,
  boxHeight: number,
  style?: TextStyleSeed,
): { x: number; y: number; node: Omit<EditorNode, "id" | "parentId"> } {
  const node = createTextNode(worldX, worldY, boxWidth, boxHeight, "auto-width", style);
  return { x: worldX, y: worldY, node };
}

/** Draft text node at drag endpoints (caller assigns id / inserts). */
export function createTextDraftNodeFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  style?: TextStyleSeed,
  phase: ShapeDragPhase = "commit",
): Omit<EditorNode, "id" | "parentId"> {
  const box = textGeometryPatchFromDrag(start, end, modifiers, phase);
  const mode: TextResizeMode =
    Math.hypot(end.x - start.x, end.y - start.y) < 4 ? "auto-width" : "fixed";
  return createTextNode(box.x, box.y, box.width, box.height, mode, style, phase);
}

/** Fixed-size text box from a drag gesture (Figma area text). */
export function createTextBoxFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  style?: TextStyleSeed,
): { x: number; y: number; width: number; height: number; node: Omit<EditorNode, "id" | "parentId"> } {
  const node = createTextDraftNodeFromDrag(start, end, modifiers, style, "commit");
  return { x: node.x, y: node.y, width: node.width, height: node.height, node };
}
