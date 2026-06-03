"use client";

import type { RefObject } from "react";
import { worldToViewport } from "@/lib/canvasCoordinates";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { startLayoutGuideMoveSession } from "@/lib/layoutGuideMove";
import { useEditorStore } from "@/stores/useEditorStore";

const STROKE = CANVAS_VISUAL.layoutGuide;
const SELECTED_STROKE = "#c084fc";
const HIT_PX = 8;
const LINE_PX = 1;
const SELECTED_LINE_PX = 2;

type GuideLine = { id: string; axis: "v" | "h"; pos: number; isDraft?: boolean };

/** Layout guides in viewport space — constant 1px screen width while panning/zooming. */
export function LayoutGuidesOverlay({
  zoom,
  pan,
  viewportRef,
}: {
  zoom: number;
  pan: { x: number; y: number };
  viewportRef: RefObject<HTMLElement | null>;
}) {
  const layoutGuides = useEditorStore((s) => s.layoutGuides);
  const draft = useEditorStore((s) => s.layoutGuideDraft);
  const selectedLayoutGuideId = useEditorStore((s) => s.selectedLayoutGuideId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const selectLayoutGuide = useEditorStore((s) => s.selectLayoutGuide);

  if (editorMode !== "design") return null;
  if (layoutGuides.length === 0 && !draft) return null;

  const lines: GuideLine[] = draft
    ? [...layoutGuides, { id: "__draft__", axis: draft.axis, pos: draft.pos, isDraft: true }]
    : layoutGuides;

  const onGuidePointerDown = (guideId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectLayoutGuide(guideId);
    const viewport = viewportRef.current;
    if (!viewport) return;
    startLayoutGuideMoveSession({
      guideId,
      pointerId: e.pointerId,
      captureTarget: e.currentTarget as HTMLElement,
      viewportEl: viewport,
    });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[34] overflow-hidden" aria-hidden={false}>
      {lines.map((g) => {
        const isDraft = Boolean(g.isDraft);
        const selected = !isDraft && g.id === selectedLayoutGuideId;
        const color = selected ? SELECTED_STROKE : STROKE;
        const linePx = selected ? SELECTED_LINE_PX : LINE_PX;
        const vp =
          g.axis === "v"
            ? worldToViewport(g.pos, 0, pan, zoom)
            : worldToViewport(0, g.pos, pan, zoom);

        if (g.axis === "v") {
          const left = vp.x - HIT_PX / 2;
          return (
            <div key={g.id} className="absolute inset-y-0" style={{ left, width: HIT_PX }}>
              {!isDraft ? (
                <div
                  role="presentation"
                  className="absolute inset-0 cursor-col-resize pointer-events-auto"
                  onPointerDown={(e) => onGuidePointerDown(g.id, e)}
                />
              ) : null}
              <div
                className="pointer-events-none absolute bottom-0 top-0"
                style={{
                  left: HIT_PX / 2 - linePx / 2,
                  width: linePx,
                  backgroundColor: color,
                  opacity: isDraft ? 0.85 : 1,
                  backgroundImage: isDraft
                    ? `repeating-linear-gradient(to bottom, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`
                    : undefined,
                }}
              />
            </div>
          );
        }

        const top = vp.y - HIT_PX / 2;
        return (
          <div key={g.id} className="absolute inset-x-0" style={{ top, height: HIT_PX }}>
            {!isDraft ? (
              <div
                role="presentation"
                className="absolute inset-0 cursor-row-resize pointer-events-auto"
                onPointerDown={(e) => onGuidePointerDown(g.id, e)}
              />
            ) : null}
            <div
              className="pointer-events-none absolute left-0 right-0"
              style={{
                top: HIT_PX / 2 - linePx / 2,
                height: linePx,
                backgroundColor: color,
                opacity: isDraft ? 0.85 : 1,
                backgroundImage: isDraft
                  ? `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`
                  : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
