"use client";

import { useCallback, useMemo } from "react";
import { beginCanvasSwapHandleDrag } from "@/lib/canvasNodeDrag";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import {
  multiSelectSwapHandleIds,
  swapHandleWorldCenter,
} from "@/lib/canvasSwapDrag";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { SwapPinkDot } from "./SwapPinkDot";

const SWAP_HANDLE_HIT_SCREEN_PX = 28;

/** Pink center handles on multi-selected layers for Figma-style position swap. */
export function MultiSelectSwapHandlesOverlay() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const editorMode = useEditorStore((s) => s.editorMode);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const isMovingSelection = useEditorStore((s) => s.isMovingSelection);
  const swapDragIndicator = useEditorStore((s) => s.swapDragIndicator);
  const clientToWorld = useCanvasToWorld();
  const overlay = useCanvasOverlaySpace();

  const handleIds = useMemo(
    () => multiSelectSwapHandleIds(selectedIds, nodes, childOrder),
    [selectedIds, nodes, childOrder],
  );

  const resolveClientToWorld = useCallback(
    (clientX: number, clientY: number) =>
      clientToWorld
        ? clientToWorld(clientX, clientY)
        : clientToWorldFromDocument(clientX, clientY, { pan, zoom }),
    [clientToWorld, pan, zoom],
  );

  if (
    editorMode !== "design" ||
    transformInteractionMode !== "none" ||
    isMovingSelection ||
    swapDragIndicator ||
    handleIds.length < 2
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-visible" aria-hidden>
      <style>{`
        @keyframes swap-pink-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.12); opacity: 0.9; }
        }
      `}</style>
      {handleIds.map((id) => {
        const center = swapHandleWorldCenter(id, nodes, childOrder);
        const screen = worldPointToOverlay(center.x, center.y, overlay);
        return (
          <button
            key={id}
            type="button"
            className="absolute cursor-grab border-0 bg-transparent p-0 active:cursor-grabbing"
            style={{
              left: screen.x,
              top: screen.y,
              width: SWAP_HANDLE_HIT_SCREEN_PX,
              height: SWAP_HANDLE_HIT_SCREEN_PX,
              transform: "translate(-50%, -50%)",
              pointerEvents: "auto",
            }}
            aria-label="Swap position with another selected layer"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              beginCanvasSwapHandleDrag({
                nodeId: id,
                pointerId: e.pointerId,
                clientX: e.clientX,
                clientY: e.clientY,
                clientToWorld: resolveClientToWorld,
                captureTarget: e.currentTarget,
              });
            }}
          >
            <SwapPinkDot left={SWAP_HANDLE_HIT_SCREEN_PX / 2} top={SWAP_HANDLE_HIT_SCREEN_PX / 2} variant="solid" />
          </button>
        );
      })}
    </div>
  );
}
