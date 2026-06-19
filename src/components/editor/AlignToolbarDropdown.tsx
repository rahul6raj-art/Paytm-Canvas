"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { LayerAlignLeftIcon } from "./design-panel/InspectorSettingIcons";
import { cn } from "@/lib/utils";
import { alignableSelectionIds, canAlignSelection } from "@/lib/alignSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { AlignControls } from "./AlignControls";
import { EditorHintWrap } from "./EditorHoverHint";

export function AlignToolbarDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4);
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const tops = alignableSelectionIds(selectedIds, nodes);
  const canAlign = canAlignSelection(selectedIds, nodes, childOrder);
  const alignTitle = canAlign
    ? tops.length >= 2
      ? `Align ${tops.length} layers`
      : "Align to parent frame"
    : "Align — select 2+ layers or one layer inside a frame";

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="dialog"
        aria-label="Align and distribute"
        className="fixed z-[100] w-[220px] editor-floating-menu border border-app-border bg-app-surface p-2.5 shadow-lg"
        style={{ left: position.left, top: position.top }}
      >
        <AlignControls variant="panel" onAction={() => setOpen(false)} />
      </div>
    ) : null;

  return (
    <>
      <div className="relative shrink-0" ref={anchorRef}>
        <EditorHintWrap title={alignTitle} hintSide="bottom">
          <button
            type="button"
            aria-label="Align and distribute"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex h-8 items-center gap-0.5 rounded-md border px-1.5 text-ui font-medium transition-colors",
              open
                ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.15)] text-white"
                : canAlign
                  ? "border-app-border bg-app-toolbar-well text-app-muted hover:border-white/15 hover:bg-app-hover hover:text-app-fg"
                  : "border-app-border-subtle bg-app-toolbar-well text-app-subtle hover:border-white/10 hover:text-app-muted",
            )}
          >
            <LayerAlignLeftIcon />
            <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2} />
          </button>
        </EditorHintWrap>
      </div>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
