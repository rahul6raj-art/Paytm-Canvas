"use client";

import { useMemo } from "react";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { textBaselineWorldSegment } from "@/lib/text/textBaseline";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

/** Figma-style baseline guide for a selected text layer (hidden while editing). */
export function TextBaselineGuide() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const overlay = useCanvasOverlaySpace();

  const textId = useMemo(() => {
    if (editingTextId) return null;
    if (selectedIds.length !== 1) return null;
    const id = selectedIds[0]!;
    return nodes[id]?.type === "text" ? id : null;
  }, [editingTextId, selectedIds, nodes]);

  const line = useMemo(() => {
    if (!textId) return null;
    const node = nodes[textId];
    if (!node || node.type !== "text") return null;
    const segment = textBaselineWorldSegment(textId, node, nodes, childOrder);
    if (!segment) return null;
    const p1 = worldPointToOverlay(segment.x1, segment.y1, overlay);
    const p2 = worldPointToOverlay(segment.x2, segment.y2, overlay);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }, [textId, nodes, childOrder, overlay]);

  if (editorMode !== "design" || !line) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[31] h-full w-full overflow-visible"
      aria-hidden
    >
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke={CANVAS_VISUAL.selection}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
