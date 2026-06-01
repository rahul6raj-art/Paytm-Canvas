"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronDown,
  Space,
} from "lucide-react";
import { useEditorStore, type AlignDirection } from "@/stores/useEditorStore";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { cn } from "@/lib/utils";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";

export function AlignToolbarDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4);
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });

  const canAlign = tops.length >= 2;
  const canDistribute = tops.length >= 3;

  const runAlign = (d: AlignDirection) => {
    alignSelection(d);
    setOpen(false);
  };
  const runDist = (axis: "horizontal" | "vertical") => {
    distributeSelection(axis);
    setOpen(false);
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[100] min-w-[200px] rounded-md border border-white/[0.1] bg-[#1e1e1e] py-1 shadow-lg"
        style={{ left: position.left, top: position.top }}
      >
        <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Align</div>
        <button type="button" role="menuitem" disabled={!canAlign} className={row} onClick={() => runAlign("left")}>
          <AlignStartHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Align left
        </button>
        <button type="button" role="menuitem" disabled={!canAlign} className={row} onClick={() => runAlign("center-h")}>
          <AlignCenterHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Align horizontal centers
        </button>
        <button type="button" role="menuitem" disabled={!canAlign} className={row} onClick={() => runAlign("right")}>
          <AlignEndHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Align right
        </button>
        <button type="button" role="menuitem" disabled={!canAlign} className={row} onClick={() => runAlign("top")}>
          <AlignStartVertical className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Align top
        </button>
        <button type="button" role="menuitem" disabled={!canAlign} className={row} onClick={() => runAlign("center-v")}>
          <AlignCenterVertical className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Align vertical centers
        </button>
        <button type="button" role="menuitem" disabled={!canAlign} className={row} onClick={() => runAlign("bottom")}>
          <AlignEndVertical className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Align bottom
        </button>
        <div className="my-1 h-px bg-white/[0.08]" />
        <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Distribute</div>
        <button type="button" role="menuitem" disabled={!canDistribute} className={row} onClick={() => runDist("horizontal")}>
          <Space className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          Distribute horizontal
        </button>
        <button type="button" role="menuitem" disabled={!canDistribute} className={row} onClick={() => runDist("vertical")}>
          <Space className="h-3.5 w-3.5 shrink-0 rotate-90 opacity-80" strokeWidth={1.75} />
          Distribute vertical
        </button>
      </div>
    ) : null;

  return (
    <>
      <div className="relative shrink-0" ref={anchorRef}>
        <button
          type="button"
          aria-label="Align and distribute"
          aria-expanded={open}
          title="Align & distribute"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-8 items-center gap-0.5 rounded-md border px-1.5 text-[11px] font-medium transition-colors",
            open
              ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.15)] text-white"
              : "border-white/[0.08] bg-black/25 text-[#c4c4c4] hover:border-white/15 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          <AlignStartHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2} />
        </button>
      </div>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}

const row =
  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-[#e6e6e6] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";
