"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ChevronDown,
  Circle,
  Hexagon,
  Minus,
  PencilLine,
  Sparkles,
  Square,
  Triangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolButton } from "./ToolButton";
import { CanvasToolRailIcon } from "./CanvasToolRailIcon";
import {
  CANVAS_TOOL_RAIL_SPLIT_CHEVRON_CLASS,
  CANVAS_TOOL_RAIL_SPLIT_MAIN_CLASS,
  isShapeTool,
  type ShapeTool,
} from "@/lib/canvasToolRail";
import { useEditorStore, type Tool } from "@/stores/useEditorStore";
import { clearPostCreationPointerSuppress } from "@/lib/canvasCreationGuard";
import { activateCanvasForShortcuts } from "@/lib/editorKeyboardFocus";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";

type ShapeToolItem = {
  id: ShapeTool;
  label: string;
  icon: typeof Square;
  shortcut?: string;
};

const shapeItems: ShapeToolItem[] = [
  { id: "rect", label: "Rectangle", icon: Square, shortcut: "R" },
  { id: "ellipse", label: "Ellipse / Circle", icon: Circle, shortcut: "O" },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: ArrowRight, shortcut: "⇧L" },
  { id: "pencil", label: "Freehand", icon: PencilLine, shortcut: "⇧P" },
  { id: "polygon", label: "Polygon", icon: Hexagon },
  { id: "star", label: "Star", icon: Sparkles },
  { id: "triangle", label: "Triangle", icon: Triangle },
];

const shapeIconByTool: Record<ShapeTool, typeof Square> = {
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowRight,
  pencil: PencilLine,
  polygon: Hexagon,
  star: Sparkles,
  triangle: Triangle,
};

export function ShapeToolDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tool = useEditorStore((s) => s.tool);
  const lastShapeTool = useEditorStore((s) => s.lastShapeTool);
  const setTool = useEditorStore((s) => s.setTool);

  const position = useAnchoredDropdownPosition(wrapRef, open, 4, {
    viewportClamp: true,
    maxHeight: 320,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), wrapRef, menuRef);

  useEffect(() => setMounted(true), []);

  const activeShape = isShapeTool(tool) ? tool : null;
  const displayShape = activeShape ?? lastShapeTool;
  const DisplayIcon = shapeIconByTool[displayShape];

  const pick = (t: Tool) => {
    clearPostCreationPointerSuppress();
    setTool(t);
    setOpen(false);
    requestAnimationFrame(() => activateCanvasForShortcuts());
  };

  const activateShape = () => {
    setTool(displayShape);
  };

  const displayMeta = shapeItems.find((s) => s.id === displayShape);
  const drawHint =
    displayShape === "pencil"
      ? "drag on canvas to draw"
      : displayShape === "line" || displayShape === "arrow"
        ? "drag — ⇧ snap 45°, ⌥ from center"
        : "drag on canvas to draw";

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[100] min-w-[200px] rounded-md border border-app-border bg-app-panel py-0.5 shadow-lg"
        style={anchoredMenuStyle(position)}
      >
        {shapeItems.map(({ id, label, icon: Icon, shortcut }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui font-medium transition-colors",
              tool === id ? "bg-accent/20 text-white" : "text-app-fg hover:bg-app-hover",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(id)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3]" strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            {shortcut ? <span className="text-ui text-app-subtle">{shortcut}</span> : null}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div ref={wrapRef} className="relative flex shrink-0">
        <ToolButton
          active={activeShape != null}
          title={
            activeShape
              ? `${displayMeta?.label ?? "Shape"} — ${drawHint}`
              : `${displayMeta?.label ?? "Shape"} (${displayMeta?.shortcut ?? "R"}) — ${drawHint}`
          }
          onClick={activateShape}
          className={CANVAS_TOOL_RAIL_SPLIT_MAIN_CLASS}
        >
          <CanvasToolRailIcon icon={DisplayIcon} />
        </ToolButton>
        <ToolButton
          active={open}
          title="More shapes"
          aria-label="Shape menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={CANVAS_TOOL_RAIL_SPLIT_CHEVRON_CLASS}
        >
          <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.5} />
        </ToolButton>
      </div>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
