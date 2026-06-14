"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Component } from "lucide-react";
import { canCreateComponentFromSelection } from "@/lib/componentModel";
import { formatShortcutLabel } from "@/lib/commands";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import {
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
} from "@/lib/inspectorIconStyles";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";

const menuRow =
  "flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-35";

export function CreateComponentDropdown({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);

  const canCreate = !disabled && canCreateComponentFromSelection(selectedIds, nodes);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    maxHeight: 200,
    width: 220,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);
  useEffect(() => setMounted(true), []);

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[120] overflow-hidden rounded-md border border-app-border bg-app-panel py-1 shadow-xl"
        style={{ left: position.left, top: position.top }}
      >
        <div className="section-heading px-2.5 py-1">Component</div>
        <button
          type="button"
          role="menuitem"
          disabled={!canCreate}
          className={menuRow}
          onClick={() => {
            createComponentFromSelection();
            setOpen(false);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Component className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
            Create component
          </span>
          <span className="font-mono text-ui text-app-subtle">{formatShortcutLabel("⌘⌥K")}</span>
        </button>
      </div>
    ) : null;

  return (
    <>
      <div ref={anchorRef} className="inline-flex -m-1.5 p-1.5">
        <button
          type="button"
          title="Create component"
          aria-label="Create component"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={!canCreate}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            inspectorHeaderActionBtnClass,
            "h-8 min-h-8 w-auto min-w-9 shrink-0 gap-0.5 px-1.5",
            "text-violet-200 hover:bg-violet-500/15 hover:text-violet-100",
            open && "bg-violet-500/15 text-violet-100",
          )}
        >
          <Component {...inspectorLucideProps()} />
          <ChevronDown
            className={cn(inspectorIconClass, "h-3 w-3 opacity-70")}
            strokeWidth={inspectorIconStroke}
          />
        </button>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
