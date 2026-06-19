"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
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
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import {
  BooleanMenuIcon,
  BooleanMenuIconSlot,
  BooleanOperationIconSlot,
  BooleanFlattenIcon,
  EditObjectIcon,
  UseAsMaskIcon,
} from "./design-panel/BooleanOperationIcons";
import { EditorHintWrap } from "./EditorHoverHint";

const row =
  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-35";

const OPS: { op: BooleanOperation; keys: string }[] = [
  { op: "union", keys: "⌘⌥U" },
  { op: "subtract", keys: "⌘⌥S" },
  { op: "intersect", keys: "⌘⌥I" },
  { op: "exclude", keys: "⌘⌥E" },
];

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
        className="fixed z-[120] min-w-[220px] overflow-hidden editor-floating-menu border border-app-border bg-app-panel py-1 shadow-xl"
        style={{ left: position.left, top: position.top }}
      >
        <div className="section-heading px-2.5 py-1">Boolean</div>
        {OPS.map(({ op, keys }) => {
          const selected = isBoolGroup && activeOp === op;
          return (
            <button
              key={op}
              type="button"
              role="menuitem"
              disabled={!canBoolean && !isBoolGroup}
              className={row}
              onClick={() => runOp(op)}
            >
              <BooleanOperationIconSlot op={op} />
              <span className="min-w-0 flex-1">{BOOLEAN_OPERATION_LABELS[op]}</span>
              {selected ? (
                <Check className={cn(inspectorIconClass, "text-accent")} strokeWidth={inspectorIconStroke} />
              ) : (
                <span className="font-mono text-ui text-app-subtle">{keys}</span>
              )}
            </button>
          );
        })}
        <div className="my-1 h-px bg-app-hover" />
        <button
          type="button"
          role="menuitem"
          disabled={!isBoolGroup}
          className={row}
          onClick={() => {
            flattenSelection();
            setOpen(false);
          }}
        >
          <BooleanMenuIconSlot>
            <BooleanFlattenIcon />
          </BooleanMenuIconSlot>
          <span className="min-w-0 flex-1">Flatten</span>
          <span className="font-mono text-ui text-app-subtle">⌘⌥F</span>
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!isBoolGroup}
          className={row}
          onClick={() => {
            if (single) enterObjectEditMode(single.id);
            setOpen(false);
          }}
        >
          <BooleanMenuIconSlot>
            <EditObjectIcon />
          </BooleanMenuIconSlot>
          <span className="min-w-0 flex-1">Edit object</span>
        </button>
        <div className="my-1 h-px bg-app-hover" />
        <button
          type="button"
          role="menuitem"
          disabled={!canBoolean}
          className={row}
          onClick={() => {
            useSelectionAsMask();
            setOpen(false);
          }}
        >
          <BooleanMenuIconSlot>
            <UseAsMaskIcon />
          </BooleanMenuIconSlot>
          <span className="min-w-0 flex-1">Use as mask</span>
          <span className="font-mono text-ui text-app-subtle">⌘⌥M</span>
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
                "gap-0.5",
                open && "bg-app-hover text-app-fg",
                enabled && "text-app-muted",
              )}
            >
              <BooleanMenuIcon />
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
              open && "border-app-border bg-app-hover text-white",
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
