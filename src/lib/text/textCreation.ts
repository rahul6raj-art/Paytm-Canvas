import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import { boundsFromDrag, type Point, type ShapeModifiers } from "@/lib/shapes/shapeCreation";
import { computeTextBoxSize } from "@/lib/text/textLayout";
import {
  EMPTY_TEXT_PLACEHOLDER_WIDTH,
  MIN_TEXT_BOX,
  type TextResizeMode,
} from "@/lib/text/textNodeModel";

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

/** Build a new text node (caller assigns id/parent and inserts). */
export function createTextNode(
  x: number,
  y: number,
  width: number,
  height: number,
  mode: TextResizeMode,
  style?: TextStyleSeed,
): Omit<EditorNode, "id" | "parentId"> {
  const typo = resolveTextTypo(style ?? {});
  const size = computeTextBoxSize("", typo, mode, width, height);
  const boxW =
    mode === "auto-width"
      ? Math.max(size.width, EMPTY_TEXT_PLACEHOLDER_WIDTH)
      : Math.max(MIN_TEXT_BOX, width);
  const boxH = Math.max(MIN_TEXT_BOX, size.height);
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
    textResizeMode: mode,
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

/** Fixed-width text box from a drag gesture (auto height wrapping). */
export function createTextBoxFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  style?: TextStyleSeed,
): { x: number; y: number; width: number; height: number; node: Omit<EditorNode, "id" | "parentId"> } {
  const box = boundsFromDrag(start, end, modifiers, { minSize: MIN_TEXT_BOX });
  const width = Math.max(MIN_TEXT_BOX, box.width);
  const height = Math.max(MIN_TEXT_BOX, box.height);
  const mode: TextResizeMode =
    Math.hypot(end.x - start.x, end.y - start.y) < 4 ? "auto-width" : "auto-height";
  const node = createTextNode(box.x, box.y, width, height, mode, style);
  return { x: box.x, y: box.y, width: node.width, height: node.height, node };
}
