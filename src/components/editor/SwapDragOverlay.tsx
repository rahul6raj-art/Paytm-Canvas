"use client";

import {
  getSwapTargetBounds,
  worldCenterAtCapturedOrigin,
} from "@/lib/canvasSwapDrag";
import {
  worldPointToOverlay,
  worldRectToOverlay,
} from "@/lib/canvasOverlaySpace";
import {
  CANVAS_SWAP_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
} from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { SwapPinkDot } from "./SwapPinkDot";

const PINK_RING = CANVAS_VISUAL.swapPinkRing;

/** Figma-style pink dots while dragging one layer over another to swap positions. */
export function SwapDragOverlay() {
  const indicator = useEditorStore((s) => s.swapDragIndicator);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const editorMode = useEditorStore((s) => s.editorMode);
  const overlay = useCanvasOverlaySpace();

  if (
    editorMode !== "design" ||
    !indicator ||
    !nodes[indicator.sourceId] ||
    !nodes[indicator.targetId]
  ) {
    return null;
  }

  const { sourceId, targetId, sourceOrigin, targetOrigin } = indicator;
  const targetBounds = getSwapTargetBounds(targetId, nodes, childOrder);
  const targetCenter = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height / 2,
  };
  const sourceStartCenter = worldCenterAtCapturedOrigin(
    sourceId,
    sourceOrigin,
    nodes,
    childOrder,
  );
  const targetStartCenter = worldCenterAtCapturedOrigin(
    targetId,
    targetOrigin,
    nodes,
    childOrder,
  );

  const targetScreen = worldRectToOverlay(targetBounds, overlay);
  const targetCenterScreen = worldPointToOverlay(targetCenter.x, targetCenter.y, overlay);
  const sourceStartScreen = worldPointToOverlay(
    sourceStartCenter.x,
    sourceStartCenter.y,
    overlay,
  );
  const targetStartScreen = worldPointToOverlay(
    targetStartCenter.x,
    targetStartCenter.y,
    overlay,
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[36] overflow-visible" aria-hidden>
      <style>{`
        @keyframes swap-pink-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.12); opacity: 0.9; }
        }
      `}</style>
      <div
        className="absolute box-border rounded-sm"
        style={{
          left: targetScreen.x,
          top: targetScreen.y,
          width: Math.max(1, targetScreen.width),
          height: Math.max(1, targetScreen.height),
          border: `${CANVAS_SWAP_OUTLINE_SCREEN_PX}px dashed ${PINK_RING}`,
        }}
      />
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <line
          x1={sourceStartScreen.x}
          y1={sourceStartScreen.y}
          x2={targetCenterScreen.x}
          y2={targetCenterScreen.y}
          stroke={PINK_RING}
          strokeWidth={CANVAS_SWAP_OUTLINE_SCREEN_PX}
          strokeDasharray="4 3"
        />
      </svg>
      <SwapPinkDot
        left={targetCenterScreen.x}
        top={targetCenterScreen.y}
        variant="solid"
        pulse
      />
      <SwapPinkDot
        left={sourceStartScreen.x}
        top={sourceStartScreen.y}
        variant="solid"
        pulse
      />
      <SwapPinkDot left={targetStartScreen.x} top={targetStartScreen.y} variant="ring" />
    </div>
  );
}
