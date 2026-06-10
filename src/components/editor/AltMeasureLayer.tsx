"use client";

import { useMemo } from "react";
import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { computeAltMeasureOverlay, selectionUnionBounds } from "@/lib/altMeasurements";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasInteraction } from "./CanvasInteractionContext";

const LINE = CANVAS_VISUAL.guide;
const LABEL_BG = "rgba(15, 23, 42, 0.92)";
const LABEL_FG = "#fff7ed";

function MeasureLabel({
  x,
  y,
  text,
  zoom,
}: {
  x: number;
  y: number;
  text: string;
  zoom: number;
}) {
  const font = screenPxToWorld(10, zoom);
  const padX = screenPxToWorld(6, zoom);
  const padY = screenPxToWorld(4, zoom);
  const border = screenPxToWorld(1, zoom);
  return (
    <div
      className="pointer-events-none absolute z-[2] whitespace-nowrap rounded font-mono font-semibold leading-none shadow-sm"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        background: LABEL_BG,
        color: LABEL_FG,
        border: `${border}px solid ${LINE}`,
        fontSize: `${font}px`,
        padding: `${padY}px ${padX}px`,
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
  const zoom = useEditorStore((s) => s.zoom);
  const { optionDown, optionOverSelection, optionPointerHoverId } = useCanvasInteraction();

  const effectiveHoverId = optionPointerHoverId ?? hoveredCanvasId;

  const overlay = useMemo(() => {
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

  if (!overlay || !sourceBounds) return null;

  const { targetBounds, targetLabel, lines } = overlay;

  return (
    <div className="pointer-events-none absolute inset-0 z-[36] overflow-visible" aria-hidden>
      <div
        className="absolute rounded-[1px] border border-dashed shadow-[0_0_0_1px_rgba(15,23,42,0.15)]"
        style={{
          left: targetBounds.x,
          top: targetBounds.y,
          width: targetBounds.width,
          height: targetBounds.height,
          borderColor: LINE,
        }}
      />
      <MeasureLabel
        x={targetBounds.x + 4}
        y={targetBounds.y - 18}
        text={targetLabel}
        zoom={zoom}
      />
      <MeasureLabel
        x={sourceBounds.x + sourceBounds.width / 2}
        y={sourceBounds.y + sourceBounds.height + 16}
        text={`${Math.round(sourceBounds.width)} × ${Math.round(sourceBounds.height)}`}
        zoom={zoom}
      />

      <svg
        className="absolute left-0 top-0 overflow-visible"
        width={6000}
        height={6000}
        viewBox="0 0 6000 6000"
      >
        {lines.map((d) => (
          <line
            key={d.key}
            x1={d.x1}
            y1={d.y1}
            x2={d.x2}
            y2={d.y2}
            stroke={LINE}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {lines.map((d) => (
        <MeasureLabel
          key={`lb-${d.key}`}
          x={d.labelX}
          y={d.labelY}
          text={`${d.distance}`}
          zoom={zoom}
        />
      ))}
    </div>
  );
}
