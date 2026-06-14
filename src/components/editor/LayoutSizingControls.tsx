"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  Maximize2,
  Shrink,
} from "lucide-react";
import { useEditorStore, type EditorNode, type LayoutSizingMode } from "@/stores/useEditorStore";
import type { LayoutMode } from "@/lib/autoLayout";
import { cn } from "@/lib/utils";
import { inspectorIconClass, inspectorIconStroke } from "@/lib/inspectorIconStyles";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";

type SizingOption = {
  value: LayoutSizingMode;
  label: string;
  detail: string;
  Icon: typeof Shrink;
};

const OPTIONS: SizingOption[] = [
  {
    value: "fixed",
    label: "Fixed",
    detail: "Keep this exact size",
    Icon: Maximize2,
  },
  {
    value: "hug",
    label: "Hug contents",
    detail: "Shrink to fit children or text",
    Icon: Shrink,
  },
  {
    value: "fill",
    label: "Fill container",
    detail: "Stretch along this axis in the parent",
    Icon: ArrowLeftRight,
  },
];

function axisLabel(
  node: EditorNode,
  axis: "horizontal" | "vertical",
  parentMode: LayoutMode | undefined,
  isAutoLayoutContainer: boolean,
): string {
  if (isAutoLayoutContainer && (node.layoutMode ?? "none") !== "none") {
    const mode = node.layoutMode!;
    if (axis === "horizontal") {
      return mode === "horizontal" ? "Width (primary)" : "Width (counter)";
    }
    return mode === "vertical" ? "Height (primary)" : "Height (counter)";
  }
  if (parentMode && parentMode !== "none") {
    if (axis === "horizontal") {
      return parentMode === "horizontal" ? "Width (flow)" : "Width (cross)";
    }
    return parentMode === "vertical" ? "Height (flow)" : "Height (cross)";
  }
  return axis === "horizontal" ? "Width" : "Height";
}

function currentMode(node: EditorNode, axis: "horizontal" | "vertical"): LayoutSizingMode {
  const v = axis === "horizontal" ? node.layoutSizingHorizontal : node.layoutSizingVertical;
  return v ?? "fixed";
}

function canUseFill(node: EditorNode, nodes: Record<string, EditorNode>): boolean {
  const pid = node.parentId;
  if (!pid) return false;
  const parent = nodes[pid];
  if (!parent) return false;
  return (parent.layoutMode ?? "none") !== "none";
}

export function LayoutSizingControls({
  node,
  nodes,
  locked,
}: {
  node: EditorNode;
  nodes: Record<string, EditorNode>;
  locked: boolean;
}) {
  const updateLayoutSizing = useEditorStore((s) => s.updateLayoutSizing);
  const parent = node.parentId ? nodes[node.parentId] : undefined;
  const parentMode = parent?.layoutMode;
  const isContainer =
    (node.type === "frame" || node.type === "group") && (node.layoutMode ?? "none") !== "none";
  const fillAllowed = canUseFill(node, nodes);

  return (
    <div className="space-y-2">
      {(["horizontal", "vertical"] as const).map((axis) => (
        <SizingDropdown
          key={axis}
          label={axisLabel(node, axis, parentMode, isContainer)}
          value={currentMode(node, axis)}
          disabled={locked}
          allowFill={fillAllowed}
          onSelect={(mode) => updateLayoutSizing(node.id, axis, mode)}
        />
      ))}
    </div>
  );
}

function SizingDropdown({
  label,
  value,
  disabled,
  allowFill,
  onSelect,
}: {
  label: string;
  value: LayoutSizingMode;
  disabled: boolean;
  allowFill: boolean;
  onSelect: (mode: LayoutSizingMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredDropdownPosition(anchorRef, open, 4);
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);
  useEffect(() => setMounted(true), []);

  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]!;
  const ActiveIcon = active.value === "fill" ? ArrowUpDown : active.Icon;

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[100] min-w-[200px] rounded-md border border-app-border bg-app-surface py-1 shadow-lg"
        style={{ left: position.left, top: position.top }}
      >
        {OPTIONS.filter((o) => o.value !== "fill" || allowFill).map((opt) => {
          const Icon = opt.Icon;
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              className={cn(
                "flex w-full items-start gap-2 px-2 py-1.5 text-left text-ui transition-colors",
                selected ? "bg-app-hover text-white" : "text-app-fg hover:bg-app-hover",
              )}
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
            >
              <span className="mt-0.5 flex w-4 shrink-0 justify-center">
                {selected ? <Check className={cn(inspectorIconClass, "text-accent")} strokeWidth={inspectorIconStroke} /> : null}
              </span>
              <Icon className={cn(inspectorIconClass, "mt-0.5 opacity-80")} strokeWidth={inspectorIconStroke} />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="block text-ui text-[#737373]">{opt.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div>
      <div className="mb-0.5 text-ui font-medium text-[#737373]">{label}</div>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-6 w-full items-center gap-1.5 rounded border px-2 text-left text-ui transition-colors disabled:opacity-40",
          "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
        )}
      >
        <ActiveIcon className={cn(inspectorIconClass, "opacity-80")} strokeWidth={inspectorIconStroke} />
        <span className="min-w-0 flex-1 truncate">{active.label}</span>
        <ChevronDown className={cn(inspectorIconClass, "opacity-60")} strokeWidth={inspectorIconStroke} />
      </button>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
