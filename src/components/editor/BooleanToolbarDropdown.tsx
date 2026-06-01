"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Combine } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  BOOLEAN_OPERATION_LABELS,
  getBooleanEligibleSelection,
  type BooleanOperation,
} from "@/lib/booleanGeometry";
import { cn } from "@/lib/utils";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";

const row =
  "flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[12px] text-[#e6e6e6] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35";

const OPS: { op: BooleanOperation; keys: string }[] = [
  { op: "union", keys: "⌘⌥U" },
  { op: "subtract", keys: "⌘⌥S" },
  { op: "intersect", keys: "⌘⌥I" },
  { op: "exclude", keys: "⌘⌥E" },
];

export function BooleanToolbarDropdown() {
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

  const position = useAnchoredDropdownPosition(anchorRef, open, 4);
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);
  useEffect(() => setMounted(true), []);

  const eligible = getBooleanEligibleSelection(selectedIds, nodes);
  const canBoolean = eligible.length >= 2;
  const single = selectedIds.length === 1 ? nodes[selectedIds[0]!] : null;
  const isBoolGroup = Boolean(single?.isBooleanGroup);

  const runOp = (op: BooleanOperation) => {
    createBooleanGroup(op);
    setOpen(false);
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[100] min-w-[220px] rounded-md border border-white/[0.1] bg-[#1e1e1e] py-1 shadow-lg"
        style={{ left: position.left, top: position.top }}
      >
        <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#6b6b6b]">
          Boolean
        </div>
        {OPS.map(({ op, keys }) => (
          <button
            key={op}
            type="button"
            role="menuitem"
            disabled={!canBoolean}
            className={row}
            onClick={() => runOp(op)}
          >
            <span>{BOOLEAN_OPERATION_LABELS[op]}</span>
            <span className="font-mono text-[10px] text-[#6b6b6b]">{keys}</span>
          </button>
        ))}
        <div className="my-1 h-px bg-white/[0.08]" />
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
          <span>Flatten</span>
          <span className="font-mono text-[10px] text-[#6b6b6b]">⌘⌥F</span>
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
          Edit object
        </button>
        <div className="my-1 h-px bg-white/[0.08]" />
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
          <span>Use as mask</span>
          <span className="font-mono text-[10px] text-[#6b6b6b]">⌘⌥M</span>
        </button>
      </div>
    ) : null;

  return (
    <>
      <div ref={anchorRef} className="inline-flex">
        <button
          type="button"
          title="Boolean operations"
          aria-label="Boolean operations"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-8 items-center gap-1 rounded-md border border-transparent px-2 text-[#b8b8b8] transition-colors hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white",
            open && "border-white/[0.12] bg-white/[0.06] text-white",
            (canBoolean || isBoolGroup) && "text-[#c4c4c4]",
          )}
        >
          <Combine className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden text-[11px] font-medium lg:inline">Boolean</span>
        </button>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
