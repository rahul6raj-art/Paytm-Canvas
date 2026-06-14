"use client";

import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { CANVAS_GUIDE_LINE_SCREEN_PX, CANVAS_VISUAL } from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

const LINE = CANVAS_VISUAL.guide;
const LABEL_BG = "rgba(15, 23, 42, 0.92)";
const LABEL_FG = "#fff7ed";
const MEASURE_LABEL_FONT_SCREEN_PX = 10;
const MEASURE_LABEL_PAD_X_SCREEN_PX = 6;
const MEASURE_LABEL_PAD_Y_SCREEN_PX = 4;
const MEASURE_LABEL_BORDER_SCREEN_PX = 1;
const MEASURE_CAP_SCREEN_PX = 6;

function MeasureLabel({
  x,
  y,
  text,
}: {
  x: number;
  y: number;
  text: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[1] whitespace-nowrap rounded font-mono font-semibold leading-none shadow-sm"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        background: LABEL_BG,
        color: LABEL_FG,
        border: `${MEASURE_LABEL_BORDER_SCREEN_PX}px solid ${LINE}`,
        fontSize: `${MEASURE_LABEL_FONT_SCREEN_PX}px`,
        padding: `${MEASURE_LABEL_PAD_Y_SCREEN_PX}px ${MEASURE_LABEL_PAD_X_SCREEN_PX}px`,
      }}
    >
      {text}
    </div>
  );
}

function capOffset(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  len: number,
): { nx: number; ny: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy) || 1;
  return { nx: (-dy / d) * len, ny: (dx / d) * len };
}

/** Alignment guides + distance labels while dragging (Figma smart guides). */
export function DragSnapOverlay() {
  const guides = useEditorStore((s) => s.guides);
  const measurements = useEditorStore((s) => s.dragMeasurements);
  const editorMode = useEditorStore((s) => s.editorMode);
  const overlay = useCanvasOverlaySpace();

  if (editorMode !== "design") return null;
  if (guides.length === 0 && measurements.length === 0) return null;

  const linePx = CANVAS_GUIDE_LINE_SCREEN_PX;
  const capLen = MEASURE_CAP_SCREEN_PX;

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-visible" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {guides.map((g, i) => {
          const from = g.from ?? 0;
          const to = g.to ?? 6000;
          const p1 =
            g.axis === "v"
              ? worldPointToOverlay(g.pos, from, overlay)
              : worldPointToOverlay(from, g.pos, overlay);
          const p2 =
            g.axis === "v"
              ? worldPointToOverlay(g.pos, to, overlay)
              : worldPointToOverlay(to, g.pos, overlay);
          return (
            <line
              key={`g-${i}-${g.axis}-${g.pos}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={LINE}
              strokeWidth={linePx}
            />
          );
        })}
        {measurements.map((m, i) => {
          const a = worldPointToOverlay(m.x1, m.y1, overlay);
          const b = worldPointToOverlay(m.x2, m.y2, overlay);
          const { nx, ny } = capOffset(a.x, a.y, b.x, b.y, capLen);
          return (
            <g key={`m-${i}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={LINE} strokeWidth={linePx} />
              <line
                x1={a.x - nx}
                y1={a.y - ny}
                x2={a.x + nx}
                y2={a.y + ny}
                stroke={LINE}
                strokeWidth={linePx}
              />
              <line
                x1={b.x - nx}
                y1={b.y - ny}
                x2={b.x + nx}
                y2={b.y + ny}
                stroke={LINE}
                strokeWidth={linePx}
              />
            </g>
          );
        })}
      </svg>
      {measurements.map((m, i) => {
        const a = worldPointToOverlay(m.x1, m.y1, overlay);
        const b = worldPointToOverlay(m.x2, m.y2, overlay);
        return (
          <MeasureLabel
            key={`ml-${i}`}
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2}
            text={`${m.distance}`}
          />
        );
      })}
    </div>
  );
}
