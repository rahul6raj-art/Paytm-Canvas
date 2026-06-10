"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import {
  clampStrokeWidth,
  isFreehandPathNode,
  nodeSupportsStrokeWidth,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
} from "@/lib/strokeAdjust";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

export function StrokeWidthToolbar() {
  const tool = useEditorStore((s) => s.tool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const pencilStrokeWidth = useEditorStore((s) => s.pencilStrokeWidth);
  const setPencilStrokeWidth = useEditorStore((s) => s.setPencilStrokeWidth);
  const setSelectionStrokeWidth = useEditorStore((s) => s.setSelectionStrokeWidth);
  const nudgeSelectionStrokeWidth = useEditorStore((s) => s.nudgeSelectionStrokeWidth);

  const strokeTargets = useMemo(
    () =>
      topLevelSelectedIds(selectedIds, nodes).filter((id) => {
        const n = nodes[id];
        return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
      }),
    [selectedIds, nodes],
  );

  const singleFreehand =
    strokeTargets.length === 1 && isFreehandPathNode(nodes[strokeTargets[0]!]);

  const show = tool === "pencil" || strokeTargets.length > 0;

  const displayWidth = useMemo(
    () =>
      strokeTargets.length === 1
        ? clampStrokeWidth(nodes[strokeTargets[0]!]?.strokeWidth ?? pencilStrokeWidth)
        : clampStrokeWidth(pencilStrokeWidth),
    [strokeTargets, nodes, pencilStrokeWidth],
  );

  const [draft, setDraft] = useState(String(displayWidth));
  useEffect(() => {
    setDraft(String(displayWidth));
  }, [displayWidth]);

  if (!show) return null;

  const applyWidth = (width: number) => {
    const next = clampStrokeWidth(width);
    if (strokeTargets.length > 0) {
      setSelectionStrokeWidth(next);
      return;
    }
    setPencilStrokeWidth(next);
  };

  const title =
    tool === "pencil" && strokeTargets.length === 0
      ? "Freehand brush size — [ ] to adjust"
      : singleFreehand
        ? "Freehand stroke weight — [ ] to adjust"
        : "Stroke weight — [ ] to adjust";

  return (
    <div
      className="flex h-8 items-center gap-0.5 rounded-md border border-app-border bg-app-toolbar-well px-0.5"
      title={title}
      aria-label={title}
    >
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
        aria-label="Decrease stroke weight"
        onClick={() => nudgeSelectionStrokeWidth(-1)}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "h-7 w-10 border-0 bg-transparent text-center text-[11px] font-medium tabular-nums text-app-fg",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded",
        )}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value.replace(/[^\d.]/g, ""));
        }}
        onBlur={() => {
          const n = parseFloat(draft);
          if (Number.isFinite(n)) applyWidth(n);
          else setDraft(String(displayWidth));
        }}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => e.currentTarget.blur(),
            onArrowNudge: (dir, shift, alt) => {
              const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
              const v = parseFloat(draft);
              const base = Number.isFinite(v) ? v : displayWidth;
              const next = clampStrokeWidth(base + step);
              setDraft(String(next));
              applyWidth(next);
            },
          });
        }}
        aria-label="Stroke weight"
      />
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
        aria-label="Increase stroke weight"
        onClick={() => nudgeSelectionStrokeWidth(1)}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <span className="sr-only">
        Stroke weight between {STROKE_WIDTH_MIN} and {STROKE_WIDTH_MAX}
      </span>
    </div>
  );
}
