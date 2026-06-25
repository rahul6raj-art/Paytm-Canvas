"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Component, Layers } from "lucide-react";
import { canCreateComponentFromSelection } from "@/lib/componentModel";
import { canCreateComponentSetFromSelection } from "@/lib/componentUx";
import { formatShortcutLabel } from "@/lib/commands";
import {
  editorMenuItemClass,
  editorMenuPanelClass,
} from "@/lib/editorMenuChrome";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import {
  inspectorHeaderDropdownAnchorClass,
  inspectorHeaderDropdownBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
} from "@/lib/inspectorIconStyles";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
  anchoredMenuStyle,
} from "../useAnchoredDropdown";

export function CreateComponentDropdown({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
  const createComponentSetFromSelection = useEditorStore((s) => s.createComponentSetFromSelection);

  const canCreate = !disabled && canCreateComponentFromSelection(selectedIds, nodes);
  const canCreateSet = !disabled && canCreateComponentSetFromSelection(selectedIds, nodes);

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
        data-editor-shell
        className={cn(editorMenuPanelClass, "z-[120] min-w-[220px]")}
        style={anchoredMenuStyle(position)}
      >
        <div className="section-heading">Component</div>
        <button
          type="button"
          role="menuitem"
          disabled={!canCreate}
          className={cn(editorMenuItemClass, "!justify-start gap-2.5")}
          onClick={() => {
            createComponentFromSelection();
            setOpen(false);
          }}
        >
          <span className="inline-flex min-w-0 flex-1 items-center gap-2.5">
            <Component className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
            <span className="truncate">Create component</span>
          </span>
          <span className="editor-menu-dropdown-shortcut">{formatShortcutLabel("⌘⌥K")}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canCreateSet}
          data-testid="create-component-set-dropdown"
          className={cn(editorMenuItemClass, "!justify-start gap-2.5")}
          onClick={() => {
            createComponentSetFromSelection();
            setOpen(false);
          }}
        >
          <span className="inline-flex min-w-0 flex-1 items-center gap-2.5">
            <Layers className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
            <span className="truncate">Create component set</span>
          </span>
        </button>
      </div>
    ) : null;

  return (
    <>
      <div ref={anchorRef} className={inspectorHeaderDropdownAnchorClass}>
        <EditorHintWrap title="Component actions" disabled={!canCreate && !canCreateSet}>
          <button
            type="button"
            aria-label="Component actions"
            aria-expanded={open}
            aria-haspopup="menu"
            disabled={!canCreate && !canCreateSet}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              inspectorHeaderDropdownBtnClass,
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
        </EditorHintWrap>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
