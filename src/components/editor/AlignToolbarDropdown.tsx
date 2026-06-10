"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlignLeft, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { alignableSelectionIds } from "@/lib/alignSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { AlignControls } from "./AlignControls";

export function AlignToolbarDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4);
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const tops = alignableSelectionIds(selectedIds, nodes);
  const canAlign = tops.length >= 2;

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="dialog"
        aria-label="Align and distribute"
        className="fixed z-[100] w-[220px] rounded-md border border-app-border bg-app-surface p-2.5 shadow-lg"
        style={{ left: position.left, top: position.top }}
      >
        <AlignControls variant="panel" onAction={() => setOpen(false)} />
      </div>
    ) : null;

  return (
    <>
      <div className="relative shrink-0" ref={anchorRef}>
        <button
          type="button"
          aria-label="Align and distribute"
          aria-expanded={open}
          title={
            canAlign
              ? `Align ${tops.length} layers`
              : "Align — select 2 or more layers"
          }
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-8 items-center gap-0.5 rounded-md border px-1.5 text-[11px] font-medium transition-colors",
            open
              ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.15)] text-white"
              : canAlign
                ? "border-app-border bg-app-toolbar-well text-app-muted hover:border-white/15 hover:bg-app-hover hover:text-app-fg"
                : "border-app-border-subtle bg-app-toolbar-well text-app-subtle hover:border-white/10 hover:text-app-muted",
          )}
        >
          <AlignLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2} />
        </button>
      </div>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
