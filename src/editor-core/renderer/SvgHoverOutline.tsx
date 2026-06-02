"use client";

import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import {
  getNodeWorldMatrix,
  matrixToCssTransform,
  nodeNeedsOrientedOverlay,
} from "@/lib/transformMath";
import { worldRect } from "@/lib/tree";
import { useEditorStore } from "@/stores/useEditorStore";

/** Single hover ring for SVG mode (DOM objects are not mounted). */
export function SvgHoverOutline() {
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const nodes = useEditorStore((s) => s.nodes);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);

  if (!hoveredCanvasId || editingTextId || pathEditModeNodeId) return null;
  if (selectedIds.includes(hoveredCanvasId)) return null;

  const node = nodes[hoveredCanvasId];
  if (!node?.visible || node.locked) return null;

  const ringColor =
    editorMode === "inspect" ? CANVAS_VISUAL.inspectHover : CANVAS_VISUAL.hoverOutline;

  const oriented = nodeNeedsOrientedOverlay(hoveredCanvasId, nodes);
  const worldMatrix = oriented ? getNodeWorldMatrix(hoveredCanvasId, nodes) : null;

  if (oriented && worldMatrix) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[18]" aria-hidden>
        <div
          className="absolute box-border"
          style={{
            left: 0,
            top: 0,
            width: node.width,
            height: node.height,
            transform: matrixToCssTransform(worldMatrix),
            transformOrigin: "0 0",
            boxShadow: `0 0 0 1px ${ringColor}`,
          }}
        />
      </div>
    );
  }

  const wr = worldRect(hoveredCanvasId, nodes);
  return (
    <div className="pointer-events-none absolute inset-0 z-[18]" aria-hidden>
      <div
        className="absolute box-border"
        style={{
          left: wr.x,
          top: wr.y,
          width: wr.width,
          height: wr.height,
          boxShadow: `0 0 0 1px ${ringColor}`,
        }}
      />
    </div>
  );
}
