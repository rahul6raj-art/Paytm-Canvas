"use client";

import {
  getSwapTargetBounds,
  worldCenterAtCapturedOrigin,
} from "@/lib/canvasSwapDrag";
import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";

const PINK = CANVAS_VISUAL.swapPink;
const PINK_RING = CANVAS_VISUAL.swapPinkRing;

function SwapPinkDot({
  cx,
  cy,
  zoom,
  variant,
}: {
  cx: number;
  cy: number;
  zoom: number;
  variant: "solid" | "ring";
}) {
  const r = screenPxToWorld(5, zoom);
  const stroke = screenPxToWorld(2, zoom);
  const size = r * 2;
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: cx,
        top: cy,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        background: variant === "solid" ? PINK : "transparent",
        border: `${stroke}px solid ${variant === "solid" ? "#ffffff" : PINK}`,
        boxShadow:
          variant === "solid"
            ? `0 0 0 ${screenPxToWorld(1, zoom)}px ${PINK_RING}`
            : `0 0 0 ${screenPxToWorld(1, zoom)}px rgba(255, 255, 255, 0.9)`,
        animation: variant === "solid" ? "swap-pink-pulse 0.85s ease-in-out infinite" : undefined,
      }}
    />
  );
}

/** Figma-style pink dots while dragging one layer over another to swap positions. */
export function SwapDragOverlay() {
  const indicator = useEditorStore((s) => s.swapDragIndicator);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const editorMode = useEditorStore((s) => s.editorMode);
  const zoom = useEditorStore((s) => s.zoom);

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

  const strokeW = screenPxToWorld(1.5, zoom);

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
          left: targetBounds.x,
          top: targetBounds.y,
          width: Math.max(1, targetBounds.width),
          height: Math.max(1, targetBounds.height),
          border: `${strokeW}px dashed ${PINK_RING}`,
        }}
      />
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <line
          x1={sourceStartCenter.x}
          y1={sourceStartCenter.y}
          x2={targetCenter.x}
          y2={targetCenter.y}
          stroke={PINK_RING}
          strokeWidth={strokeW}
          strokeDasharray={`${screenPxToWorld(4, zoom)} ${screenPxToWorld(3, zoom)}`}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <SwapPinkDot cx={targetCenter.x} cy={targetCenter.y} zoom={zoom} variant="solid" />
      <SwapPinkDot
        cx={sourceStartCenter.x}
        cy={sourceStartCenter.y}
        zoom={zoom}
        variant="solid"
      />
      <SwapPinkDot
        cx={targetStartCenter.x}
        cy={targetStartCenter.y}
        zoom={zoom}
        variant="ring"
      />
    </div>
  );
}
