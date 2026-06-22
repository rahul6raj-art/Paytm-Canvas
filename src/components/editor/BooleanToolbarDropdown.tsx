"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  BOOLEAN_OPERATION_LABELS,
  getBooleanEligibleSelection,
  type BooleanOperation,
} from "@/lib/booleanGeometry";
import { cn } from "@/lib/utils";
import {
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
} from "@/lib/inspectorIconStyles";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import {
  BooleanMenuIcon,
  BooleanOperationIconSlot,
  BooleanFlattenIcon,
  EditObjectIcon,
  UseAsMaskIcon,
} from "./design-panel/BooleanOperationIcons";
import { EditorHintWrap } from "./EditorHoverHint";

const OPS: { op: BooleanOperation; keys: string }[] = [
  { op: "union", keys: "⌘⌥U" },
  { op: "subtract", keys: "⌘⌥S" },
  { op: "intersect", keys: "⌘⌥I" },
  { op: "exclude", keys: "⌘⌥E" },
];

function BooleanMenuSeparator() {
  return <div className="my-1 border-t border-app-border-subtle" role="separator" />;
}

export function BooleanOperationsDropdown({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "inspector";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const createBooleanGroup = useEditorStore((s) => s.createBooleanGroup);
  const flattenSelection = useEditorStore((s) => s.flattenSelection);
  const enterObjectEditMode = useEditorStore((s) => s.enterObjectEditMode);
  const useSelectionAsMask = useEditorStore((s) => s.useSelectionAsMask);
  const updateBooleanOperation = useEditorStore((s) => s.updateBooleanOperation);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    maxHeight: 360,
    width: 240,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);
  useEffect(() => setMounted(true), []);

  const eligible = getBooleanEligibleSelection(selectedIds, nodes);
  const canBoolean = eligible.length >= 2;
  const single = selectedIds.length === 1 ? nodes[selectedIds[0]!] : null;
  const isBoolGroup = Boolean(single?.isBooleanGroup);
  const activeOp = single?.booleanOperation ?? "union";

  const runOp = (op: BooleanOperation) => {
    if (isBoolGroup && single) {
      updateBooleanOperation(single.id, op);
    } else {
      createBooleanGroup(op);
    }
    setOpen(false);
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Boolean operations"
        data-editor-shell
        className={cn(
          "editor-floating-menu editor-menu-dropdown fixed min-w-[220px] overflow-hidden",
          "z-[120]",
        )}
        style={anchoredMenuStyle(position)}
      >
        {OPS.map(({ op, keys }) => {
          const selected = isBoolGroup && activeOp === op;
          return (
            <button
              key={op}
              type="button"
              role="menuitem"
              disabled={!canBoolean && !isBoolGroup}
              className={cn(
                "editor-menu-dropdown-item !justify-start gap-2.5",
                selected && "bg-app-inset font-medium text-app-fg",
              )}
              onClick={() => runOp(op)}
            >
              <BooleanOperationIconSlot op={op} />
              <span className="min-w-0 flex-1 truncate">{BOOLEAN_OPERATION_LABELS[op]}</span>
              {selected ? (
                <Check
                  className={cn(inspectorIconClass, "shrink-0 text-app-fg")}
                  strokeWidth={inspectorIconStroke}
                />
              ) : (
                <span className="editor-menu-dropdown-shortcut">{keys}</span>
              )}
            </button>
          );
        })}

        <BooleanMenuSeparator />

        <button
          type="button"
          role="menuitem"
          disabled={!isBoolGroup}
          className="editor-menu-dropdown-item !justify-start gap-2.5"
          onClick={() => {
            flattenSelection();
            setOpen(false);
          }}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-app-fg">
            <BooleanFlattenIcon />
          </span>
          <span className="min-w-0 flex-1 truncate">Flatten</span>
          <span className="editor-menu-dropdown-shortcut">⌘⌥F</span>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!isBoolGroup}
          className="editor-menu-dropdown-item !justify-start gap-2.5"
          onClick={() => {
            if (single) enterObjectEditMode(single.id);
            setOpen(false);
          }}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-app-fg">
            <EditObjectIcon />
          </span>
          <span className="min-w-0 flex-1 truncate">Edit object</span>
        </button>

        <BooleanMenuSeparator />

        <button
          type="button"
          role="menuitem"
          disabled={!canBoolean}
          className="editor-menu-dropdown-item !justify-start gap-2.5"
          onClick={() => {
            useSelectionAsMask();
            setOpen(false);
          }}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-app-fg">
            <UseAsMaskIcon />
          </span>
          <span className="min-w-0 flex-1 truncate">Use as mask</span>
          <span className="editor-menu-dropdown-shortcut">⌘⌥M</span>
        </button>
      </div>
    ) : null;

  const enabled = canBoolean || isBoolGroup;

  if (variant === "inspector") {
    return (
      <>
        <div ref={anchorRef} className="inline-flex">
          <EditorHintWrap title="Boolean operations" disabled={!enabled}>
            <button
              type="button"
              aria-label="Boolean operations"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((v) => !v)}
              disabled={!enabled}
              className={cn(
                inspectorHeaderActionBtnClass,
                "h-8 min-h-8 w-8 min-w-8 max-w-8",
                open ? "bg-app-hover text-app-fg" : enabled ? "text-app-muted" : undefined,
              )}
            >
              <BooleanMenuIcon className="h-[18px] w-[18px]" />
            </button>
          </EditorHintWrap>
        </div>
        {menu ? createPortal(menu, document.body) : null}
      </>
    );
  }

  return (
    <>
      <div ref={anchorRef} className="inline-flex">
        <EditorHintWrap title="Boolean operations" hintSide="bottom">
          <button
            type="button"
            aria-label="Boolean operations"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex h-8 items-center gap-1 rounded-md border border-transparent px-2 text-app-muted transition-colors hover:border-app-border hover:bg-app-hover hover:text-app-fg",
              open && "border-app-border bg-app-hover text-app-fg",
              enabled && "text-app-muted",
            )}
          >
            <BooleanMenuIcon className="h-4 w-4" />
            <span className="hidden text-ui font-medium lg:inline">Boolean</span>
          </button>
        </EditorHintWrap>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}

/** @deprecated Use BooleanOperationsDropdown */
export function BooleanToolbarDropdown() {
  return <BooleanOperationsDropdown variant="toolbar" />;
}
