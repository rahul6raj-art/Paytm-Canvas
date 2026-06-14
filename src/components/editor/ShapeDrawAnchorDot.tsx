"use client";

import { canvasShapeDraftDotStyle } from "@/lib/canvasVisual";
import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { isZeroAreaDraftNode } from "@/lib/shapes/shapeDraft";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

/** Blue anchor dot at the press point while a new layer is still 0×0. */
export function ShapeDrawAnchorDot() {
  const shapeSession = useEditorStore((s) => s.shapeDrawingSession);
  const frameSession = useEditorStore((s) => s.frameDrawingSession);
  const textSession = useEditorStore((s) => s.textDrawingSession);
  const session = shapeSession ?? frameSession ?? textSession;
  const node = useEditorStore((s) =>
    session ? s.nodes[session.nodeId] : undefined,
  );
  const overlay = useCanvasOverlaySpace();

  if (!session || !node || !isZeroAreaDraftNode(node)) return null;

  const { x, y } = worldPointToOverlay(session.start.x, session.start.y, overlay);

  return (
    <div
      className="pointer-events-none absolute z-[12] -translate-x-1/2 -translate-y-1/2"
      style={{
        left: x,
        top: y,
        ...canvasShapeDraftDotStyle(),
      }}
      aria-hidden
    />
  );
}
