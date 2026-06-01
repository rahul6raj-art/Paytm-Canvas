"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, Circle, Hexagon, Minus, Shapes, Sparkles, Square, Triangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolButton } from "./ToolButton";
import { useEditorStore, type Tool } from "@/stores/useEditorStore";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";

type ShapeTool = "rect" | "ellipse" | "line" | "arrow" | "polygon" | "star" | "triangle";

const shapeItems: {
  id: ShapeTool;
  label: string;
  icon: typeof Square;
  shortcut?: string;
}[] = [
  { id: "rect", label: "Rectangle", icon: Square, shortcut: "R" },
  { id: "ellipse", label: "Ellipse / Circle", icon: Circle, shortcut: "O" },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: ArrowRight, shortcut: "⇧L" },
  { id: "polygon", label: "Polygon", icon: Hexagon },
  { id: "star", label: "Star", icon: Sparkles },
  { id: "triangle", label: "Triangle", icon: Triangle },
];

const SHAPE_TOOLS: ShapeTool[] = ["rect", "ellipse", "line", "arrow", "polygon", "star", "triangle"];

export function ShapeToolDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  const position = useAnchoredDropdownPosition(wrapRef, open);
  useDismissAnchoredDropdown(open, () => setOpen(false), wrapRef, menuRef);

  useEffect(() => setMounted(true), []);

  const activeShape = SHAPE_TOOLS.includes(tool as ShapeTool) ? (tool as ShapeTool) : null;

  const ActiveIcon =
    activeShape === "ellipse"
      ? Circle
      : activeShape === "line"
        ? Minus
        : activeShape === "arrow"
          ? ArrowRight
          : activeShape === "polygon"
            ? Hexagon
            : activeShape === "star"
              ? Sparkles
              : activeShape === "triangle"
                ? Triangle
                : activeShape === "rect"
                  ? Square
                  : Shapes;

  const pick = (t: Tool) => {
    setTool(t);
    setOpen(false);
  };

  const activateShape = () => {
    setTool(activeShape ?? "rect");
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[100] min-w-[200px] rounded-md border border-white/[0.08] bg-[#2a2a2a] py-0.5 shadow-lg"
        style={{ left: position.left, top: position.top }}
      >
        {shapeItems.map(({ id, label, icon: Icon, shortcut }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors",
              tool === id ? "bg-accent/20 text-white" : "text-[#d4d4d4] hover:bg-white/[0.06]",
            )}
            onClick={() => pick(id)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3]" strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            {shortcut ? <span className="text-[10px] text-[#6b6b6b]">{shortcut}</span> : null}
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
              ? `${shapeItems.find((s) => s.id === activeShape)?.label ?? "Shape"} — drag on canvas to draw`
              : "Rectangle (R) — drag on canvas to draw"
          }
          onClick={activateShape}
          className="h-8 min-w-8 shrink-0 rounded-r-none px-1.5"
        >
          <ActiveIcon className="h-[15px] w-[15px]" strokeWidth={1.85} />
        </ToolButton>
        <ToolButton
          active={open}
          title="More shapes"
          aria-label="Shape menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="h-8 w-5 shrink-0 rounded-l-none border-l border-white/[0.06] px-0"
        >
          <ChevronDown className="h-2.5 w-2.5 opacity-60" strokeWidth={2.5} />
        </ToolButton>
      </div>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
