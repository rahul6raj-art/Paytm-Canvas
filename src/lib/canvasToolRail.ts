import type { Tool } from "@/stores/useEditorStore";

/** Primary canvas tools shown on the Figma-style vertical rail (Track 26). */
export const CANVAS_TOOL_RAIL_TOOLS: {
  id: Tool;
  label: string;
  shortcut?: string;
}[] = [
  { id: "move", label: "Move", shortcut: "V" },
  { id: "pen", label: "Pen", shortcut: "P" },
  { id: "text", label: "Text", shortcut: "T" },
  { id: "hand", label: "Hand", shortcut: "H" },
  { id: "comment", label: "Comment", shortcut: "C" },
];

export function canvasToolRailTitle(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

/** Bottom canvas tool rail sizing (buttons were 36px; now 40px). */
export const CANVAS_TOOL_RAIL_BUTTON_CLASS = "h-10 w-10 leading-none [&_svg]:block";
/** Lift rail above status footer / overflow clip (12px was tight on some layouts). */
export const CANVAS_TOOL_RAIL_BOTTOM_OFFSET = 20;
/** @deprecated Use positioned drag layout; kept for layout tests referencing bottom inset. */
export const CANVAS_TOOL_RAIL_OFFSET_CLASS = "bottom-5";

const TOOL_RAIL_POSITION_KEY = "craft-canvas-tool-rail-position-v2";
const TOOL_RAIL_POSITION_PAD = 8;

export type CanvasToolRailPosition = { left: number; top: number };

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readCanvasToolRailPosition(): CanvasToolRailPosition | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(TOOL_RAIL_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CanvasToolRailPosition;
    if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCanvasToolRailPosition(position: CanvasToolRailPosition): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(TOOL_RAIL_POSITION_KEY, JSON.stringify(position));
  } catch {
    /* ignore quota */
  }
}

export function clampCanvasToolRailPosition(
  left: number,
  top: number,
  railWidth: number,
  railHeight: number,
  workspace: { width: number; height: number },
): CanvasToolRailPosition {
  return {
    left: Math.max(
      TOOL_RAIL_POSITION_PAD,
      Math.min(left, workspace.width - railWidth - TOOL_RAIL_POSITION_PAD),
    ),
    top: Math.max(
      TOOL_RAIL_POSITION_PAD,
      Math.min(top, workspace.height - railHeight - TOOL_RAIL_POSITION_PAD),
    ),
  };
}

export function defaultCanvasToolRailPosition(
  railWidth: number,
  railHeight: number,
  workspace: { width: number; height: number },
): CanvasToolRailPosition {
  return clampCanvasToolRailPosition(
    (workspace.width - railWidth) / 2,
    workspace.height - railHeight - CANVAS_TOOL_RAIL_BOTTOM_OFFSET,
    railWidth,
    railHeight,
    workspace,
  );
}
/** Integer px size — pairs with Lucide absoluteStrokeWidth for sharp strokes. */
export const CANVAS_TOOL_RAIL_ICON_SIZE = 16;
export const CANVAS_TOOL_RAIL_ICON_STROKE = 1.75;
export const CANVAS_TOOL_RAIL_SPLIT_MAIN_CLASS = "h-10 min-w-10 shrink-0 rounded-r-none px-1.5";
export const CANVAS_TOOL_RAIL_SPLIT_CHEVRON_CLASS =
  "h-10 w-6 shrink-0 rounded-l-none border-l border-app-border-subtle px-0";

/** Shape variants on the canvas tool rail (rectangle split button). */
export type ShapeTool =
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "pencil"
  | "polygon"
  | "star"
  | "triangle";

export const SHAPE_TOOLS: readonly ShapeTool[] = [
  "rect",
  "ellipse",
  "line",
  "arrow",
  "pencil",
  "polygon",
  "star",
  "triangle",
];

export function isShapeTool(tool: string): tool is ShapeTool {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}
