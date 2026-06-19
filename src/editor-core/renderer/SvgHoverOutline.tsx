"use client";

import { useMemo } from "react";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import {
  worldPointToOverlay,
  worldRectToOverlay,
  crispOverlayHairlineRect,
} from "@/lib/canvasOverlaySpace";
import { getRenderedWorldBounds, getNodeTransformedWorldCornersFromChildOrder } from "@/lib/editorGraph";
import { compositeSelectionBoundsId } from "@/lib/compositeSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "@/components/editor/useCanvasOverlaySpace";

const OVERLAY_STROKE = {
  strokeWidth: 1,
  vectorEffect: "non-scaling-stroke" as const,
  shapeRendering: "crispEdges" as const,
};

/** Hover ring in viewport pixels — constant 1px stroke at any zoom. */
export function SvgHoverOutline() {
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const overlay = useCanvasOverlaySpace();

  const ringColor =
    editorMode === "inspect" ? CANVAS_VISUAL.inspectHover : CANVAS_VISUAL.hoverOutline;

  const outline = useMemo(() => {
    if (!hoveredCanvasId || editingTextId || pathEditModeNodeId) return null;
    if (selectedIds.includes(hoveredCanvasId)) return null;
    const node = nodes[hoveredCanvasId];
    if (!node?.visible || node.locked) return null;

    const outlineId = compositeSelectionBoundsId(hoveredCanvasId, nodes, {
      objectEditModeNodeId,
      selectedIds,
    });

    const corners = getNodeTransformedWorldCornersFromChildOrder(outlineId, nodes, childOrder);
    if (corners) {
      return {
        kind: "polygon" as const,
        points: corners.map((c) => worldPointToOverlay(c.x, c.y, overlay)),
      };
    }
    const wr = getRenderedWorldBounds(outlineId, nodes, childOrder);
    return {
      kind: "rect" as const,
      rect: crispOverlayHairlineRect(worldRectToOverlay(wr, overlay)),
    };
  }, [
    hoveredCanvasId,
    selectedIds,
    editingTextId,
    pathEditModeNodeId,
    objectEditModeNodeId,
    nodes,
    childOrder,
    overlay,
  ]);

  if (!outline) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[28] overflow-visible"
      width="100%"
      height="100%"
      aria-hidden
    >
      {outline.kind === "rect" ? (
        <rect
          x={outline.rect.x}
          y={outline.rect.y}
          width={outline.rect.width}
          height={outline.rect.height}
          fill="none"
          stroke={ringColor}
          {...OVERLAY_STROKE}
        />
      ) : (
        <polygon
          points={outline.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={ringColor}
          {...OVERLAY_STROKE}
        />
      )}
    </svg>
  );
}
