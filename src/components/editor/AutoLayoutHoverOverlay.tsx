"use client";

import { useMemo } from "react";
import { getAutoLayoutHoverContext } from "@/lib/autoLayout";
import {
  AUTO_LAYOUT_SPACING_LINE_SCREEN_PX,
  AUTO_LAYOUT_SPACING_TICK_SCREEN_PX,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";

const GAP_COLOR = "#ff24ff";
const CHILD_STROKE = "rgba(255, 36, 255, 0.35)";

/** Hover feedback for flow children inside auto layout — sibling gaps and child bounds. */
export function AutoLayoutHoverOverlay() {
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);

  const ctx = useMemo(() => {
    if (editorMode !== "design" || transformInteractionMode !== "none") return null;
    if (!hoveredCanvasId || selectedIds.includes(hoveredCanvasId)) return null;
    return getAutoLayoutHoverContext(hoveredCanvasId, nodes, childOrder);
  }, [
    editorMode,
    transformInteractionMode,
    hoveredCanvasId,
    selectedIds,
    nodes,
    childOrder,
  ]);

  if (!ctx) return null;

  const lineW = screenPxToWorld(AUTO_LAYOUT_SPACING_LINE_SCREEN_PX, zoom);
  const tickHalf = screenPxToWorld(AUTO_LAYOUT_SPACING_TICK_SCREEN_PX, zoom);
  const { childHighlight } = ctx;

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-visible" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <rect
          x={childHighlight.x}
          y={childHighlight.y}
          width={childHighlight.width}
          height={childHighlight.height}
          fill={CHILD_STROKE}
          stroke={GAP_COLOR}
          strokeWidth={lineW}
          rx={lineW}
          vectorEffect="non-scaling-stroke"
        />
        {ctx.gapGuides.map((g, i) => {
          const isVertical = g.x1 === g.x2;
          const xMid = (g.x1 + g.x2) / 2;
          const yMid = (g.y1 + g.y2) / 2;
          const x1 = isVertical ? g.x1 : xMid - tickHalf;
          const x2 = isVertical ? g.x2 : xMid + tickHalf;
          const y1 = isVertical ? yMid - tickHalf : g.y1;
          const y2 = isVertical ? yMid + tickHalf : g.y2;
          return (
            <line
              key={`hover-gap-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={GAP_COLOR}
              strokeWidth={lineW}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}
