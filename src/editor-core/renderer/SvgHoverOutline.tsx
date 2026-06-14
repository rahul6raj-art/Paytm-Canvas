"use client";

import { useMemo } from "react";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import { compositeSelectionBoundsId } from "@/lib/compositeSelection";
import { getNodeTransformedWorldCorners } from "@/lib/transformMath";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "@/components/editor/useCanvasOverlaySpace";

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

  const outlinePoints = useMemo(() => {
    if (!hoveredCanvasId || editingTextId || pathEditModeNodeId) return null;
    if (selectedIds.includes(hoveredCanvasId)) return null;
    const node = nodes[hoveredCanvasId];
    if (!node?.visible || node.locked) return null;

    const outlineId = compositeSelectionBoundsId(hoveredCanvasId, nodes, {
      objectEditModeNodeId,
      selectedIds,
    });

    const corners = getNodeTransformedWorldCorners(outlineId, nodes);
    if (corners) {
      return corners.map((c) => worldPointToOverlay(c.x, c.y, overlay));
    }
    const wr = getRenderedWorldBounds(outlineId, nodes, childOrder);
    return [
      worldPointToOverlay(wr.x, wr.y, overlay),
      worldPointToOverlay(wr.x + wr.width, wr.y, overlay),
      worldPointToOverlay(wr.x + wr.width, wr.y + wr.height, overlay),
      worldPointToOverlay(wr.x, wr.y + wr.height, overlay),
    ];
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

  if (!outlinePoints) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[28] overflow-visible"
      width="100%"
      height="100%"
      aria-hidden
    >
      <polygon
        points={outlinePoints.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={ringColor}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
