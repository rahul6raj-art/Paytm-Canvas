"use client";

import { useMemo } from "react";
import { worldPointToOverlay, worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import {
  AUTO_LAYOUT_SPACING_LINE_SCREEN_PX,
  AUTO_LAYOUT_SPACING_TICK_SCREEN_PX,
} from "@/lib/canvasVisual";
import { getAutoLayoutHoverContext } from "@/lib/autoLayout";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

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
  const overlay = useCanvasOverlaySpace();

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

  const linePx = AUTO_LAYOUT_SPACING_LINE_SCREEN_PX;
  const tickHalf = AUTO_LAYOUT_SPACING_TICK_SCREEN_PX;
  const { childHighlight } = ctx;
  const childScreen = worldRectToOverlay(childHighlight, overlay);

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-visible" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <rect
          x={childScreen.x}
          y={childScreen.y}
          width={childScreen.width}
          height={childScreen.height}
          fill={CHILD_STROKE}
          stroke={GAP_COLOR}
          strokeWidth={linePx}
          rx={linePx}
        />
        {ctx.gapGuides.map((g, i) => {
          const isVertical = g.x1 === g.x2;
          const a = worldPointToOverlay(g.x1, g.y1, overlay);
          const b = worldPointToOverlay(g.x2, g.y2, overlay);
          const xMid = (a.x + b.x) / 2;
          const yMid = (a.y + b.y) / 2;
          const x1 = isVertical ? a.x : xMid - tickHalf;
          const x2 = isVertical ? b.x : xMid + tickHalf;
          const y1 = isVertical ? yMid - tickHalf : a.y;
          const y2 = isVertical ? yMid + tickHalf : b.y;
          return (
            <line
              key={`hover-gap-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={GAP_COLOR}
              strokeWidth={linePx}
            />
          );
        })}
      </svg>
    </div>
  );
}
