"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  AUTO_LAYOUT_SPACING_LINE_SCREEN_PX,
  AUTO_LAYOUT_SPACING_TICK_SCREEN_PX,
} from "@/lib/canvasVisual";
import {
  screenPxToOverlay,
  worldPointToOverlay,
} from "@/lib/canvasOverlaySpace";
import {
  beginSelectionSpacingDrag,
  getSelectionSpacingDragPreview,
  subscribeSelectionSpacingDragPreview,
} from "@/lib/selectionSpacingDrag";
import { getSelectionSpacingHandles } from "@/lib/selectionSpacingHandles";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { CanvasEditValueBadge } from "./CanvasEditValueBadge";

const GAP_COLOR = "#ff24ff";
const HIT_SCREEN_PX = 28;

/** Figma-style pink gap handles between multi-selected layers (screen-space overlay). */
export function SelectionSpacingHandlesOverlay() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const editorMode = useEditorStore((s) => s.editorMode);
  const zoom = useEditorStore((s) => s.zoom);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const isMovingSelection = useEditorStore((s) => s.isMovingSelection);
  const overlay = useCanvasOverlaySpace();

  const preview = useSyncExternalStore(
    subscribeSelectionSpacingDragPreview,
    getSelectionSpacingDragPreview,
    () => null,
  );

  const handles = useMemo(
    () => getSelectionSpacingHandles(selectedIds, nodes, childOrder),
    [selectedIds, nodes, childOrder],
  );

  const lineW = screenPxToOverlay(AUTO_LAYOUT_SPACING_LINE_SCREEN_PX, overlay);
  const spacingTickHalf = screenPxToOverlay(AUTO_LAYOUT_SPACING_TICK_SCREEN_PX, overlay);
  const hitSize = screenPxToOverlay(HIT_SCREEN_PX, overlay);
  const arrowPx = screenPxToOverlay(12, overlay);

  const onHandleDown = useCallback(
    (handle: (typeof handles)[number]) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      beginSelectionSpacingDrag({
        handle,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        captureTarget: e.currentTarget,
      });
    },
    [],
  );

  if (
    editorMode !== "design" ||
    transformInteractionMode !== "none" ||
    isMovingSelection ||
    handles.length === 0
  ) {
    return null;
  }

  const previewScreen = preview
    ? worldPointToOverlay(preview.worldX, preview.worldY, overlay)
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[36] overflow-visible" aria-hidden>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {handles.map((h) => {
          const isHorizontal = h.axis === "horizontal";
          const lineA = worldPointToOverlay(h.lineA.x, h.lineA.y, overlay);
          const lineB = worldPointToOverlay(h.lineB.x, h.lineB.y, overlay);
          const tickCenter = worldPointToOverlay(h.worldX, h.worldY, overlay);
          const tickA = isHorizontal
            ? { x: tickCenter.x, y: tickCenter.y - spacingTickHalf }
            : { x: tickCenter.x - spacingTickHalf, y: tickCenter.y };
          const tickB = isHorizontal
            ? { x: tickCenter.x, y: tickCenter.y + spacingTickHalf }
            : { x: tickCenter.x + spacingTickHalf, y: tickCenter.y };
          return (
            <g key={`${h.axis}-${h.beforeId}-${h.afterId}`}>
              <line
                x1={lineA.x}
                y1={lineA.y}
                x2={lineB.x}
                y2={lineB.y}
                stroke={GAP_COLOR}
                strokeWidth={lineW}
                opacity={0.55}
              />
              <line
                x1={tickA.x}
                y1={tickA.y}
                x2={tickB.x}
                y2={tickB.y}
                stroke={GAP_COLOR}
                strokeWidth={lineW}
              />
            </g>
          );
        })}
      </svg>

      {handles.map((h) => {
        const isHorizontal = h.axis === "horizontal";
        const center = worldPointToOverlay(h.worldX, h.worldY, overlay);
        return (
          <button
            key={`hit-${h.axis}-${h.beforeId}-${h.afterId}`}
            type="button"
            data-selection-spacing-handle
            aria-label="Adjust spacing between selected layers"
            className="pointer-events-auto absolute touch-none flex items-center justify-center border-0 bg-[rgba(255,36,255,0.14)] p-0"
            style={{
              left: center.x,
              top: center.y,
              width: hitSize,
              height: hitSize,
              transform: "translate(-50%, -50%)",
              cursor: isHorizontal ? "ew-resize" : "ns-resize",
            }}
            onPointerDown={onHandleDown(h)}
          >
            <span
              className="pointer-events-none select-none font-bold leading-none drop-shadow-sm"
              style={{ color: GAP_COLOR, fontSize: arrowPx }}
              aria-hidden
            >
              {isHorizontal ? "↔" : "↕"}
            </span>
          </button>
        );
      })}

      {preview && previewScreen ? (
        <CanvasEditValueBadge
          x={previewScreen.x}
          y={previewScreen.y}
          zoom={zoom}
          placement="center"
          background={GAP_COLOR}
          screenSpace
          stableWidth
        >
          {preview.label}
        </CanvasEditValueBadge>
      ) : null}
    </div>
  );
}
