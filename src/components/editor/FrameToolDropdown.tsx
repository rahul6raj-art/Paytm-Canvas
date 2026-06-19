"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Frame as FrameIcon, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolButton } from "./ToolButton";
import { CanvasToolRailIcon } from "./CanvasToolRailIcon";
import {
  CANVAS_TOOL_RAIL_SPLIT_CHEVRON_CLASS,
  CANVAS_TOOL_RAIL_SPLIT_MAIN_CLASS,
} from "@/lib/canvasToolRail";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  FRAME_CUSTOM_PRESET_ID,
  FRAME_PRESET_CATEGORIES,
  FRAME_PRESETS,
  getFramePreset,
  resolveFramePresetSize,
} from "@/lib/framePresets";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { activateCanvasForShortcuts } from "@/lib/editorKeyboardFocus";

export function FrameToolDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tool = useEditorStore((s) => s.tool);
  const framePresetId = useEditorStore((s) => s.framePresetId);
  const setTool = useEditorStore((s) => s.setTool);
  const setFramePresetId = useEditorStore((s) => s.setFramePresetId);

  const position = useAnchoredDropdownPosition(wrapRef, open, 4, {
    viewportClamp: true,
    maxHeight: 360,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), wrapRef, menuRef);

  useEffect(() => setMounted(true), []);

  const active = tool === "frame";
  const preset = getFramePreset(framePresetId);
  const size = resolveFramePresetSize(framePresetId);
  const isCustom = framePresetId === FRAME_CUSTOM_PRESET_ID;

  const activateFrame = () => {
    setTool("frame");
    requestAnimationFrame(() => activateCanvasForShortcuts());
  };

  const pickPreset = (id: string) => {
    setFramePresetId(id);
    setTool("frame");
    setOpen(false);
    requestAnimationFrame(() => activateCanvasForShortcuts());
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        data-editor-shell
        className="editor-floating-menu fixed z-[100] max-h-[min(420px,70vh)] min-w-[220px] overflow-y-auto border border-app-border bg-app-panel shadow-lg thin-scroll"
        style={anchoredMenuStyle(position)}
      >
        {FRAME_PRESET_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <div className="section-heading">{cat.label}</div>
            {FRAME_PRESETS.filter((p) => p.category === cat.id).map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className={cn(
                  framePresetId === p.id ? "bg-accent/20 text-white" : undefined,
                )}
                onClick={() => pickPreset(p.id)}
              >
                <FrameIcon className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3]" strokeWidth={1.75} />
                <span className="flex-1">{p.label}</span>
                <span className="shrink-0 font-mono text-ui text-app-subtle">
                  {p.width}×{p.height}
                </span>
              </button>
            ))}
          </div>
        ))}
        <div className="my-0.5 border-t border-app-border-subtle" />
        <button
          type="button"
          role="menuitem"
          className={cn(isCustom ? "bg-accent/20 text-white" : undefined)}
          onClick={() => pickPreset(FRAME_CUSTOM_PRESET_ID)}
        >
          <PenLine className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3]" strokeWidth={1.75} />
          <span className="flex-1">Draw custom</span>
          <span className="shrink-0 text-ui text-app-subtle">drag</span>
        </button>
        <p className="px-3.5 pb-2 pt-1 text-ui leading-snug text-app-subtle">
          Click canvas to place preset · drag to draw any size
        </p>
      </div>
    ) : null;

  const title = active
    ? isCustom
      ? "Frame (F) — click or drag on canvas to draw"
      : `${preset?.label ?? "Frame"} (${size.width}×${size.height}) — click to place, drag for custom size`
    : "Frame tool (F) — device presets & draw custom";

  return (
    <>
      <div ref={wrapRef} className="relative flex shrink-0">
        <ToolButton
          active={active}
          title={title}
          aria-label="Frame tool"
          onClick={activateFrame}
          className={CANVAS_TOOL_RAIL_SPLIT_MAIN_CLASS}
        >
          <CanvasToolRailIcon icon={FrameIcon} />
        </ToolButton>
        <ToolButton
          active={open}
          title="Frame presets"
          aria-label="Frame device presets"
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
