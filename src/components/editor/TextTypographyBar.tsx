"use client";

import { useMemo } from "react";
import { Bold } from "lucide-react";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { TEXT_FONT_SIZES, TEXT_FONT_WEIGHTS } from "@/lib/textTypography";
import { FontFamilyPicker } from "./FontFamilyPicker";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

function useActiveTextNodeId(): string | null {
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);

  return useMemo(() => {
    if (editingTextId && nodes[editingTextId]?.type === "text") return editingTextId;
    if (selectedIds.length === 1) {
      const id = selectedIds[0]!;
      if (nodes[id]?.type === "text") return id;
    }
    return null;
  }, [editingTextId, selectedIds, nodes]);
}

export function TextTypographyBar() {
  const nodeId = useActiveTextNodeId();
  const nodes = useEditorStore((s) => s.nodes);
  const designTokens = useEditorStore((s) => s.designTokens);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const raw = nodeId ? nodes[nodeId] : null;
  if (!nodeId || !raw || raw.type !== "text" || raw.locked) return null;

  const node = resolveNodeWithDesignTokens(mergeInstanceOverrides(raw, nodes), designTokens);
  const disabled = raw.locked;

  const patch = (p: Parameters<typeof updateNodeStyle>[1]) => {
    pushHistory();
    updateNodeStyle(nodeId, p);
  };

  const fontFamily = node.fontFamily ?? "var(--font-inter), Inter, system-ui, sans-serif";
  const fontSize = node.fontSize ?? 13;
  const fontWeight = node.fontWeight ?? 500;

  const field =
    "h-7 rounded-md border border-app-border bg-app-field text-[11px] text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45";

  return (
    <div className="flex h-9 min-w-0 items-center border-t border-app-border-subtle px-2">
      <div
        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1"
        role="toolbar"
        aria-label="Text typography"
      >
      <FontFamilyPicker
        value={fontFamily}
        disabled={disabled}
        onChange={(fontFamily) => patch({ fontFamily })}
        className="max-w-[140px] shrink-0"
        buttonClassName="w-full min-w-[100px]"
      />

      <select
        aria-label="Font size"
        disabled={disabled}
        className={cn(field, "w-[60px] shrink-0 cursor-pointer px-2 pr-6 tabular-nums")}
        value={fontSize}
        onChange={(e) => patch({ fontSize: Number(e.target.value) })}
      >
        {!TEXT_FONT_SIZES.includes(fontSize as (typeof TEXT_FONT_SIZES)[number]) ? (
          <option value={fontSize}>{fontSize}</option>
        ) : null}
        {TEXT_FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Font weight"
        disabled={disabled}
        className={cn(field, "w-[108px] shrink-0 cursor-pointer px-2 pr-7")}
        value={fontWeight}
        onChange={(e) => patch({ fontWeight: Number(e.target.value) })}
      >
        {TEXT_FONT_WEIGHTS.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label}
          </option>
        ))}
      </select>

      <div className="hidden h-5 w-px shrink-0 bg-white/[0.1] sm:block" />

      <div className="hidden items-center gap-0.5 sm:flex">
        {TEXT_FONT_WEIGHTS.map((w) => (
          <button
            key={w.value}
            type="button"
            disabled={disabled}
            title={w.label}
            aria-label={w.label}
            aria-pressed={fontWeight === w.value}
            onClick={() => patch({ fontWeight: w.value })}
            className={cn(
              "flex h-7 min-w-7 items-center justify-center rounded-md border text-[10px] font-semibold transition-colors",
              fontWeight === w.value
                ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.15)] text-white"
                : "border-app-border bg-app-toolbar-well text-app-muted hover:border-white/15 hover:bg-app-hover hover:text-app-fg",
              w.value >= 700 && "px-1.5",
            )}
          >
            {w.value >= 700 ? <Bold className="h-3.5 w-3.5" strokeWidth={2.25} /> : w.label.slice(0, 1)}
          </button>
        ))}
      </div>
    </div>
    </div>
  );
}
