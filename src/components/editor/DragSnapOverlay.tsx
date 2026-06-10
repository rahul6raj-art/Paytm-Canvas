"use client";

import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";

const LINE = CANVAS_VISUAL.guide;
const LABEL_BG = "rgba(15, 23, 42, 0.92)";
const LABEL_FG = "#fff7ed";
const MEASURE_LABEL_FONT_SCREEN_PX = 10;
const MEASURE_LABEL_PAD_X_SCREEN_PX = 6;
const MEASURE_LABEL_PAD_Y_SCREEN_PX = 4;
const MEASURE_LABEL_BORDER_SCREEN_PX = 1;

function MeasureLabel({
  x,
  y,
  text,
  zoom,
}: {
  x: number;
  y: number;
  text: string;
  zoom: number;
}) {
  const font = screenPxToWorld(MEASURE_LABEL_FONT_SCREEN_PX, zoom);
  const padX = screenPxToWorld(MEASURE_LABEL_PAD_X_SCREEN_PX, zoom);
  const padY = screenPxToWorld(MEASURE_LABEL_PAD_Y_SCREEN_PX, zoom);
  const border = screenPxToWorld(MEASURE_LABEL_BORDER_SCREEN_PX, zoom);
  return (
    <div
      className="pointer-events-none absolute z-[1] whitespace-nowrap rounded font-mono font-semibold leading-none shadow-sm"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        background: LABEL_BG,
        color: LABEL_FG,
        border: `${border}px solid ${LINE}`,
        fontSize: `${font}px`,
        padding: `${padY}px ${padX}px`,
      }}
    >
      {text}
    </div>
  );
}

function capLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: number,
  lenScreen = 6,
) {
  const len = screenPxToWorld(lenScreen, zoom);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy) || 1;
  const nx = (-dy / d) * len;
  const ny = (dx / d) * len;
  return { nx, ny };
}

/** Alignment guides + distance labels while dragging (Figma smart guides). */
export function DragSnapOverlay() {
  const guides = useEditorStore((s) => s.guides);
  const measurements = useEditorStore((s) => s.dragMeasurements);
  const editorMode = useEditorStore((s) => s.editorMode);
  const zoom = useEditorStore((s) => s.zoom);

  if (editorMode !== "design") return null;
  if (guides.length === 0 && measurements.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-visible" aria-hidden>
      <svg
        className="absolute left-0 top-0 overflow-visible"
        width={6000}
        height={6000}
        viewBox="0 0 6000 6000"
      >
        {guides.map((g, i) => {
          const from = g.from ?? 0;
          const to = g.to ?? 6000;
          return g.axis === "v" ? (
            <line
              key={`gv-${i}-${g.pos}`}
              x1={g.pos}
              y1={from}
              x2={g.pos}
              y2={to}
              stroke={LINE}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <line
              key={`gh-${i}-${g.pos}`}
              x1={from}
              y1={g.pos}
              x2={to}
              y2={g.pos}
              stroke={LINE}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {measurements.map((m, i) => {
          const { nx, ny } = capLine(m.x1, m.y1, m.x2, m.y2, zoom);
          return (
            <g key={`m-${i}`}>
              <line
                x1={m.x1}
                y1={m.y1}
                x2={m.x2}
                y2={m.y2}
                stroke={LINE}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={m.x1 - nx}
                y1={m.y1 - ny}
                x2={m.x1 + nx}
                y2={m.y1 + ny}
                stroke={LINE}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={m.x2 - nx}
                y1={m.y2 - ny}
                x2={m.x2 + nx}
                y2={m.y2 + ny}
                stroke={LINE}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      {measurements.map((m, i) => (
        <MeasureLabel
          key={`ml-${i}`}
          x={(m.x1 + m.x2) / 2}
          y={(m.y1 + m.y2) / 2}
          text={`${m.distance}`}
          zoom={zoom}
        />
      ))}
    </div>
  );
}
