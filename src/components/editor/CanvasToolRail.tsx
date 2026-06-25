"use client";

import { useRef } from "react";
import { Hand, MessageSquare, MousePointer2, Type } from "lucide-react";
import { ToolButton } from "./ToolButton";
import { FrameToolDropdown } from "./FrameToolDropdown";
import { ShapeToolDropdown } from "./ShapeToolDropdown";
import { CanvasToolRailIcon } from "./CanvasToolRailIcon";
import { PenToolIcon } from "./PenToolIcon";
import { useDraggableCanvasToolRail } from "./useDraggableCanvasToolRail";
import { useEditorStore, type Tool } from "@/stores/useEditorStore";
import {
  CANVAS_TOOL_RAIL_BUTTON_CLASS,
  CANVAS_TOOL_RAIL_OFFSET_CLASS,
  CANVAS_TOOL_RAIL_TOOLS,
  canvasToolRailTitle,
} from "@/lib/canvasToolRail";
import { activateCanvasForShortcuts } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";

const RAIL_ICONS: Record<Exclude<Tool, "pen">, typeof MousePointer2> = {
  move: MousePointer2,
  text: Type,
  hand: Hand,
  comment: MessageSquare,
  frame: MousePointer2,
  rect: MousePointer2,
  ellipse: MousePointer2,
  line: MousePointer2,
  arrow: MousePointer2,
  pencil: MousePointer2,
  polygon: MousePointer2,
  star: MousePointer2,
  triangle: MousePointer2,
};

export function CanvasToolRail({ className }: { className?: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const { position, onRailPointerDown, isDragging } = useDraggableCanvasToolRail(railRef);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const setTool = useEditorStore((s) => s.setTool);
  const startPlacingComment = useEditorStore((s) => s.startPlacingComment);
  const uiChromeVisible = useEditorStore((s) => s.uiChromeVisible);

  if (!uiChromeVisible) return null;

  const pickTool = (id: Tool) => {
    setTool(id);
    requestAnimationFrame(() => activateCanvasForShortcuts());
  };

  return (
    <div
      ref={railRef}
      className={cn(
        "pointer-events-auto absolute z-50 flex w-fit flex-row items-center gap-1 overflow-visible editor-floating-menu border border-app-border-subtle bg-app-panel/95 p-1.5 shadow-float backdrop-blur-sm",
        position == null && `inset-x-0 ${CANVAS_TOOL_RAIL_OFFSET_CLASS} mx-auto`,
        isDragging ? "cursor-grabbing select-none" : "cursor-grab",
        className,
      )}
      style={position ? { left: position.left, top: position.top } : undefined}
      onPointerDown={onRailPointerDown}
      data-canvas-tool-rail
      aria-label="Canvas tools"
    >
      {CANVAS_TOOL_RAIL_TOOLS.slice(0, 1).map(({ id, label, shortcut }) => {
        const Icon = RAIL_ICONS[id];
        return (
          <ToolButton
            key={id}
            active={tool === id}
            aria-label={label}
            title={canvasToolRailTitle(label, shortcut)}
            className={CANVAS_TOOL_RAIL_BUTTON_CLASS}
            onClick={() => pickTool(id)}
          >
            <CanvasToolRailIcon icon={Icon} />
          </ToolButton>
        );
      })}
      <FrameToolDropdown />
      <ShapeToolDropdown />
      {CANVAS_TOOL_RAIL_TOOLS.slice(1).map(({ id, label, shortcut }) => {
        const Icon = id === "pen" ? null : RAIL_ICONS[id];
        return (
          <ToolButton
            key={id}
            active={tool === id}
            aria-label={label}
            title={canvasToolRailTitle(label, shortcut)}
            className={CANVAS_TOOL_RAIL_BUTTON_CLASS}
            disabled={id === "comment" && editorMode !== "design"}
            onClick={() => {
              if (id === "comment") {
                startPlacingComment();
                requestAnimationFrame(() => activateCanvasForShortcuts());
              } else {
                pickTool(id);
              }
            }}
          >
            {id === "pen" ? <PenToolIcon /> : <CanvasToolRailIcon icon={Icon!} />}
          </ToolButton>
        );
      })}
    </div>
  );
}
