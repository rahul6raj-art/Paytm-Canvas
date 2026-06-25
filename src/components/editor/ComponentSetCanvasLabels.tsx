"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Layers2 } from "lucide-react";
import { useCanvasChromeForeground } from "@/hooks/useCanvasChromeForeground";
import { screenPxToOverlay, worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import {
  CANVAS_FRAME_LABEL_FONT_SCREEN_PX,
  CANVAS_FRAME_LABEL_OFFSET_SCREEN_PX,
} from "@/lib/canvasVisual";
import {
  getDragPreviewOffsetForIds,
  getDragPreviewSnapshot,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";
import { worldRect } from "@/lib/tree";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

/** Figma-style title above each component set (e.g. "Component 1") — not per-variant. */
export function ComponentSetCanvasLabels() {
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const chrome = useCanvasChromeForeground();
  const overlay = useCanvasOverlaySpace();
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  void dragPreview;

  const labelOffset = screenPxToOverlay(CANVAS_FRAME_LABEL_OFFSET_SCREEN_PX, overlay);
  const labelFontSize = screenPxToOverlay(CANVAS_FRAME_LABEL_FONT_SCREEN_PX, overlay);
  const boundaryPad = screenPxToOverlay(8, overlay);

  const setContainers = useMemo(
    () => Object.values(nodes).filter((n) => n.isComponentSet && n.visible),
    [nodes],
  );

  if (setContainers.length === 0) return null;

  return (
    <>
      {setContainers.map((container) => {
        const bounds = worldRect(container.id, nodes);
        const dragOffset = getDragPreviewOffsetForIds([container.id]);
        const labelAnchor = worldPointToOverlay(
          bounds.x + dragOffset.dx,
          bounds.y + dragOffset.dy - boundaryPad,
          overlay,
        );
        const selected = selectedIds.includes(container.id);
        const color = selected ? chrome.componentFrameLabelSelected : chrome.componentFrameLabel;

        return (
          <div
            key={container.id}
            className="pointer-events-none absolute z-[9] max-w-[320px]"
            style={{
              left: labelAnchor.x,
              top: labelAnchor.y - labelOffset,
            }}
            data-component-set-label={container.id}
            aria-hidden
          >
            <span
              className="inline-flex max-w-full items-center gap-1 truncate font-medium leading-none select-none"
              style={{ fontSize: labelFontSize, color }}
            >
              <Layers2
                className="shrink-0"
                style={{ width: labelFontSize, height: labelFontSize }}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="min-w-0 truncate">{container.name}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}
