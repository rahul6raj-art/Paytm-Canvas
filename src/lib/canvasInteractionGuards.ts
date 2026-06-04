import type { EditorMode, Tool, EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { pickDeepestVisibleNodeAtWorldPoint } from "@/lib/tree";

/** Screen-pixel movement below this counts as a click, not a marquee drag. */
export const CANVAS_CLICK_SLOP_SCREEN_PX = 5;

export function isCanvasChromeTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return Boolean(
    el.closest("[data-grid-toggle]") ||
      el.closest("[data-rulers-toggle]") ||
      el.closest("[data-ruler-zone]") ||
      el.closest("[data-canvas-rulers]") ||
      el.closest("[data-comment-pin]") ||
      el.closest("[data-prototype-handle]") ||
      el.closest("[data-resize-handle]") ||
      el.closest("[data-rotate-handle]") ||
      el.closest("[data-rotate-zone]") ||
      el.closest("[data-rotate-edge]") ||
      el.closest("[data-star-ratio-handle]") ||
      el.closest("[data-star-corner-handle]") ||
      el.closest("[data-line-handle]") ||
      el.closest("[data-polygon-corner-handle]") ||
      el.closest('[role="menu"]') ||
      el.closest("[data-text-editor]") ||
      el.closest("[data-svg-hit]"),
  );
}

/** True when no visible layer exists at the world point (workspace gutter / outside artboards). */
export function isEmptyCanvasAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  return pickDeepestVisibleNodeAtWorldPoint(worldX, worldY, nodes, childOrder) === null;
}

/** Tools that create via the canvas background (clicks should pass through objects). */
export function isCanvasBgCreationTool(
  tool: Tool,
  editorMode: EditorMode,
  opts?: { isPlacingComment?: boolean },
): boolean {
  if (editorMode !== "design") return false;
  if (
    tool === "frame" ||
    tool === "rect" ||
    tool === "ellipse" ||
    tool === "line" ||
    tool === "arrow" ||
    tool === "polygon" ||
    tool === "star" ||
    tool === "triangle" ||
    tool === "pencil" ||
    tool === "text"
  ) {
    return true;
  }
  if (tool === "pen") return true;
  if (tool === "comment" && opts?.isPlacingComment) return true;
  return false;
}

/** DOM object hit target: auto for select/drag, none when bg should receive the click. */
export function canvasObjectPointerEvents(opts: {
  tool: Tool;
  editorMode: EditorMode;
  spaceDown?: boolean;
  canvasPanning?: boolean;
  isPlacingComment?: boolean;
  nodeId?: string;
}): "auto" | "none" {
  const st = useEditorStore.getState();
  if (opts.nodeId && st.editingTextId === opts.nodeId) return "auto";
  if (!canCanvasObjectInteract(opts)) return "none";
  if (isCanvasBgCreationTool(opts.tool, opts.editorMode, { isPlacingComment: opts.isPlacingComment })) {
    return "none";
  }
  return "auto";
}

/** Whether canvas object select/drag should run (shared by DOM + SVG hit layer). */
export function canCanvasObjectInteract(opts: {
  spaceDown?: boolean;
  canvasPanning?: boolean;
}): boolean {
  const st = useEditorStore.getState();
  if (st.editingTextId) return false;
  if (st.penDrawingNodeId) return false;
  if (st.pencilDrawingNodeId) return false;
  if (st.prototypeWireDrag) return false;
  if (st.isPlacingComment) return false;
  if (opts.spaceDown || opts.canvasPanning) return false;
  if (st.tool === "hand") return false;
  return true;
}

export function canCanvasObjectDrag(): boolean {
  const st = useEditorStore.getState();
  if (st.editorMode === "inspect") return false;
  if (st.tool !== "move" && st.tool !== "frame") return false;
  if (st.editingTextId) return false;
  if (st.penDrawingNodeId) return false;
  if (st.pencilDrawingNodeId) return false;
  if (st.prototypeWireDrag) return false;
  if (st.isPlacingComment) return false;
  return true;
}

export function isCanvasSelectTool(): boolean {
  const tool = useEditorStore.getState().tool;
  return (
    tool === "move" ||
    tool === "frame" ||
    tool === "rect" ||
    tool === "ellipse" ||
    tool === "line" ||
    tool === "arrow" ||
    tool === "polygon" ||
    tool === "star" ||
    tool === "triangle" ||
    tool === "pencil" ||
    tool === "text" ||
    tool === "pen"
  );
}
