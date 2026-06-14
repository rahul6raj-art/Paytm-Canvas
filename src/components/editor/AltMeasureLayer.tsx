"use client";

import { useMemo } from "react";
import { worldPointToOverlay, worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import { CANVAS_GUIDE_LINE_SCREEN_PX, CANVAS_VISUAL } from "@/lib/canvasVisual";
import { computeAltMeasureOverlay, selectionUnionBounds } from "@/lib/altMeasurements";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasInteraction } from "./CanvasInteractionContext";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

const LINE = CANVAS_VISUAL.guide;
const LABEL_BG = "rgba(15, 23, 42, 0.92)";
const LABEL_FG = "#fff7ed";

function MeasureLabel({
  x,
  y,
  text,
}: {
  x: number;
  y: number;
  text: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[2] whitespace-nowrap rounded font-mono text-ui font-semibold leading-none shadow-sm"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        background: LABEL_BG,
        color: LABEL_FG,
        border: `1px solid ${LINE}`,
        padding: "4px 6px",
      }}
    >
      {text}
    </div>
  );
}

/** Figma Option/Alt outside selection: red guides + distance labels. */
export function AltMeasureLayer() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const { optionDown, optionOverSelection, optionPointerHoverId } = useCanvasInteraction();
  const overlay = useCanvasOverlaySpace();

  const effectiveHoverId = optionPointerHoverId ?? hoveredCanvasId;

  const overlayData = useMemo(() => {
    if (editorMode !== "design" || !optionDown || optionOverSelection) return null;
    if (tool !== "move" && tool !== "frame") return null;
    if (selectedIds.length === 0) return null;
    return computeAltMeasureOverlay(selectedIds, effectiveHoverId, nodes);
  }, [
    editorMode,
    optionDown,
    optionOverSelection,
    tool,
    selectedIds,
    effectiveHoverId,
    nodes,
  ]);

  const sourceBounds = useMemo(() => {
    if (editorMode !== "design" || !optionDown || optionOverSelection) return null;
    if (selectedIds.length === 0) return null;
    return selectionUnionBounds(selectedIds, nodes);
  }, [editorMode, optionDown, optionOverSelection, selectedIds, nodes]);

  if (!overlayData || !sourceBounds) return null;

  const { targetBounds, targetLabel, lines } = overlayData;
  const targetScreen = worldRectToOverlay(targetBounds, overlay);
  const sourceScreen = worldRectToOverlay(sourceBounds, overlay);
  const linePx = CANVAS_GUIDE_LINE_SCREEN_PX;

  return (
    <div className="pointer-events-none absolute inset-0 z-[36] overflow-visible" aria-hidden>
      <div
        className="absolute rounded-[1px] border border-dashed shadow-[0_0_0_1px_rgba(15,23,42,0.15)]"
        style={{
          left: targetScreen.x,
          top: targetScreen.y,
          width: targetScreen.width,
          height: targetScreen.height,
          borderColor: LINE,
        }}
      />
      <MeasureLabel x={targetScreen.x + 4} y={targetScreen.y - 18} text={targetLabel} />
      <MeasureLabel
        x={sourceScreen.x + sourceScreen.width / 2}
        y={sourceScreen.y + sourceScreen.height + 16}
        text={`${Math.round(sourceBounds.width)} × ${Math.round(sourceBounds.height)}`}
      />

      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {lines.map((d) => {
          const a = worldPointToOverlay(d.x1, d.y1, overlay);
          const b = worldPointToOverlay(d.x2, d.y2, overlay);
          return (
            <line
              key={d.key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={LINE}
              strokeWidth={linePx}
            />
          );
        })}
      </svg>

      {lines.map((d) => {
        const label = worldPointToOverlay(d.labelX, d.labelY, overlay);
        return (
          <MeasureLabel key={`lb-${d.key}`} x={label.x} y={label.y} text={`${d.distance}`} />
        );
      })}
    </div>
  );
}
