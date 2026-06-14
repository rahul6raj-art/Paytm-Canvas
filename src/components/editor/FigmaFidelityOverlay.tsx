"use client";

import { useMemo } from "react";
import { worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { isPaytmCraftDebugCanvas } from "@/lib/env";

const FIGMA_COLOR = "rgba(59, 130, 246, 0.85)";
const CANVAS_COLOR = "rgba(249, 115, 22, 0.9)";
const DELTA_COLOR = "rgba(239, 68, 68, 0.95)";

function BoundsRect({
  rect,
  color,
  label,
  dashed,
}: {
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[3]"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        border: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        boxSizing: "border-box",
      }}
    >
      <span
        className="absolute -top-5 left-0 rounded px-1 font-mono text-[10px] font-semibold text-white shadow-sm"
        style={{ background: color }}
      >
        {label}
      </span>
    </div>
  );
}

/** Visual overlay comparing Figma source bounds vs canvas bounds for mismatched nodes. */
export function FigmaFidelityOverlay() {
  const enabled = useEditorStore((s) => s.figFidelityOverlayEnabled);
  const report = useEditorStore((s) => s.figFidelityReport);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const overlay = useCanvasOverlaySpace();

  const items = useMemo(() => {
    if (!enabled || !report || !isPaytmCraftDebugCanvas()) return [];
    const selected = new Set(selectedIds);
    const nodes = selected.size
      ? report.nodes.filter((n) => selected.has(n.nodeId))
      : report.nodes.filter((n) => n.mismatches.length > 0).slice(0, 40);
    return nodes.map((n) => {
      const fig = worldRectToOverlay(n.figBounds, overlay);
      const canvas = worldRectToOverlay(n.canvasBounds, overlay);
      return { report: n, fig, canvas };
    });
  }, [enabled, overlay, report, selectedIds]);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[18] overflow-hidden">
      {items.map(({ report: n, fig, canvas }) => {
        const hasPosDelta = Math.abs(n.positionDelta.dx) > 1 || Math.abs(n.positionDelta.dy) > 1;
        const hasSizeDelta = Math.abs(n.sizeDelta.dw) > 1 || Math.abs(n.sizeDelta.dh) > 1;
        const midX = (fig.x + fig.width / 2 + canvas.x + canvas.width / 2) / 2;
        const midY = (fig.y + fig.height / 2 + canvas.y + canvas.height / 2) / 2;
        return (
          <div key={n.nodeId}>
            <BoundsRect rect={fig} color={FIGMA_COLOR} label="Figma" dashed />
            <BoundsRect rect={canvas} color={CANVAS_COLOR} label="Canvas" />
            {(hasPosDelta || hasSizeDelta) && (
              <div
                className="absolute z-[4] rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow"
                style={{
                  left: midX,
                  top: midY,
                  transform: "translate(-50%, -50%)",
                  background: DELTA_COLOR,
                }}
              >
                {hasPosDelta && `Δ ${n.positionDelta.dx}, ${n.positionDelta.dy}`}
                {hasPosDelta && hasSizeDelta && " · "}
                {hasSizeDelta && `size ${n.sizeDelta.dw}×${n.sizeDelta.dh}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
