"use client";

import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";

const ACCENT = CANVAS_VISUAL.selection;

/** Blue insertion line while reordering a child inside auto layout (Figma-style). */
export function AutoLayoutReorderOverlay() {
  const indicator = useEditorStore((s) => s.autoLayoutReorderIndicator);
  const editorMode = useEditorStore((s) => s.editorMode);
  const zoom = useEditorStore((s) => s.zoom);

  if (editorMode !== "design" || !indicator) return null;

  const strokeW = screenPxToWorld(2, zoom);
  const cap = screenPxToWorld(4, zoom);
  const dx = indicator.x2 - indicator.x1;
  const dy = indicator.y2 - indicator.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * cap;
  const ny = (dx / len) * cap;

  return (
    <div className="pointer-events-none absolute inset-0 z-[37] overflow-visible" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <line
          x1={indicator.x1}
          y1={indicator.y1}
          x2={indicator.x2}
          y2={indicator.y2}
          stroke={ACCENT}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        <line
          x1={indicator.x1 + nx}
          y1={indicator.y1 + ny}
          x2={indicator.x1 - nx}
          y2={indicator.y1 - ny}
          stroke={ACCENT}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        <line
          x1={indicator.x2 + nx}
          y1={indicator.y2 + ny}
          x2={indicator.x2 - nx}
          y2={indicator.y2 - ny}
          stroke={ACCENT}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
