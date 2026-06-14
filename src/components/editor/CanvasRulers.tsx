"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import {
  buildRulerTicks,
  CANVAS_RULER_SIZE,
} from "@/lib/canvasRulers";
import { useCanvasChromeForeground } from "@/hooks/useCanvasChromeForeground";
import { startRulerGuideDragSession } from "@/lib/rulerGuideDrag";
import { worldToViewport } from "@/lib/canvasCoordinates";
import { useEditorStore } from "@/stores/useEditorStore";

type CanvasRulersProps = {
  zoom: number;
  pan: { x: number; y: number };
  viewportRef: React.RefObject<HTMLDivElement | null>;
};

export function CanvasRulers({ zoom, pan, viewportRef }: CanvasRulersProps) {
  const editorMode = useEditorStore((s) => s.editorMode);
  const layoutGuideDraft = useEditorStore((s) => s.layoutGuideDraft);
  const chrome = useCanvasChromeForeground();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const rulerSurfaceStyle = {
    backgroundColor: chrome.rulerBg,
    borderColor: chrome.rulerBorder,
  } as const;

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [viewportRef]);

  const horizontalTicks = useMemo(
    () => buildRulerTicks(size.width, pan.x, zoom, CANVAS_RULER_SIZE),
    [size.width, pan.x, zoom],
  );

  const verticalTicks = useMemo(
    () => buildRulerTicks(size.height, pan.y, zoom, CANVAS_RULER_SIZE),
    [size.height, pan.y, zoom],
  );

  const onRulerPointerDown = (axis: "v" | "h", e: React.PointerEvent<HTMLDivElement>) => {
    if (editorMode !== "design" || e.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    e.preventDefault();
    e.stopPropagation();
    startRulerGuideDragSession({
      axis,
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      captureTarget: e.currentTarget,
      viewportEl: viewport,
      pan,
      zoom,
    });
  };

  if (size.width < 1 || size.height < 1) return null;

  const draftH =
    layoutGuideDraft?.axis === "v"
      ? worldToViewport(layoutGuideDraft.pos, 0, pan, zoom).x
      : null;
  const draftV =
    layoutGuideDraft?.axis === "h"
      ? worldToViewport(0, layoutGuideDraft.pos, pan, zoom).y
      : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[20]" aria-hidden data-canvas-rulers>
      <div
        className="pointer-events-none absolute left-0 top-0 border-b border-r"
        style={{ width: CANVAS_RULER_SIZE, height: CANVAS_RULER_SIZE, ...rulerSurfaceStyle }}
      />
      <div
        data-ruler-zone="horizontal"
        className="pointer-events-auto absolute top-0 cursor-row-resize border-b"
        style={{
          left: CANVAS_RULER_SIZE,
          width: size.width - CANVAS_RULER_SIZE,
          height: CANVAS_RULER_SIZE,
          ...rulerSurfaceStyle,
        }}
        onPointerDown={(e) => onRulerPointerDown("h", e)}
      >
        {draftH != null && draftH >= CANVAS_RULER_SIZE ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-0.5"
            style={{
              left: draftH - CANVAS_RULER_SIZE,
              transform: "translateX(-50%)",
              backgroundColor: "#9747ff",
            }}
          />
        ) : null}
        {horizontalTicks.map((t) => (
          <div
            key={`h-${t.label}-${t.position}`}
            className="pointer-events-none absolute bottom-0 flex flex-col items-center"
            style={{ left: t.position - CANVAS_RULER_SIZE, transform: "translateX(-50%)" }}
          >
            <span
              className="mb-0.5 select-none text-ui font-medium tabular-nums leading-none"
              style={{ color: chrome.rulerLabel }}
            >
              {t.label}
            </span>
            <div className="h-1.5 w-px" style={{ backgroundColor: chrome.rulerTick }} />
          </div>
        ))}
      </div>
      <div
        data-ruler-zone="vertical"
        className="pointer-events-auto absolute left-0 cursor-col-resize border-r"
        style={{
          top: CANVAS_RULER_SIZE,
          width: CANVAS_RULER_SIZE,
          height: size.height - CANVAS_RULER_SIZE,
          ...rulerSurfaceStyle,
        }}
        onPointerDown={(e) => onRulerPointerDown("v", e)}
      >
        {draftV != null && draftV >= CANVAS_RULER_SIZE ? (
          <div
            className="pointer-events-none absolute left-0 right-0 h-0.5"
            style={{
              top: draftV - CANVAS_RULER_SIZE,
              transform: "translateY(-50%)",
              backgroundColor: "#9747ff",
            }}
          />
        ) : null}
        {verticalTicks.map((t) => (
          <div
            key={`v-${t.label}-${t.position}`}
            className="pointer-events-none absolute left-0 right-0"
            style={{ top: t.position - CANVAS_RULER_SIZE, height: 0 }}
          >
            <div
              className="absolute flex items-center justify-center"
              style={{
                right: 6,
                top: "50%",
                width: 15,
                transform: "translateY(-50%)",
              }}
            >
              <span
                className="select-none whitespace-nowrap text-ui font-medium tabular-nums leading-none"
                style={{
                  color: chrome.rulerLabel,
                  transform: "rotate(-90deg)",
                  transformOrigin: "center center",
                }}
              >
                {t.label}
              </span>
            </div>
            <div
              className="absolute right-0 top-1/2 h-px w-1.5 -translate-y-1/2"
              style={{ backgroundColor: chrome.rulerTick }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
