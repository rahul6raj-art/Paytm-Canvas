"use client";

import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

const ACCENT = CANVAS_VISUAL.selection;
const LINE_PX = 2;
const CAP_PX = 4;

/** Blue insertion line while reordering a child inside auto layout (Figma-style). */
export function AutoLayoutReorderOverlay() {
  const indicator = useEditorStore((s) => s.autoLayoutReorderIndicator);
  const editorMode = useEditorStore((s) => s.editorMode);
  const overlay = useCanvasOverlaySpace();

  if (editorMode !== "design" || !indicator) return null;

  const a = worldPointToOverlay(indicator.x1, indicator.y1, overlay);
  const b = worldPointToOverlay(indicator.x2, indicator.y2, overlay);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * CAP_PX;
  const ny = (dx / len) * CAP_PX;

  return (
    <div className="pointer-events-none absolute inset-0 z-[37] overflow-visible" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={ACCENT}
          strokeWidth={LINE_PX}
          strokeLinecap="round"
        />
        <line
          x1={a.x + nx}
          y1={a.y + ny}
          x2={a.x - nx}
          y2={a.y - ny}
          stroke={ACCENT}
          strokeWidth={LINE_PX}
          strokeLinecap="round"
        />
        <line
          x1={b.x + nx}
          y1={b.y + ny}
          x2={b.x - nx}
          y2={b.y - ny}
          stroke={ACCENT}
          strokeWidth={LINE_PX}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
