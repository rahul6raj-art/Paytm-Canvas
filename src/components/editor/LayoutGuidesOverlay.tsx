"use client";

import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { layoutGuideHitThresholdWorld } from "@/lib/layoutGuidePick";
import { useEditorStore } from "@/stores/useEditorStore";

const EXTENT = 6000;
const STROKE = CANVAS_VISUAL.layoutGuide;
const SELECTED_STROKE = "#c084fc";

/** Persistent layout guides + in-progress ruler drag preview (Figma violet lines). */
export function LayoutGuidesOverlay({ zoom }: { zoom: number }) {
  const layoutGuides = useEditorStore((s) => s.layoutGuides);
  const draft = useEditorStore((s) => s.layoutGuideDraft);
  const selectedLayoutGuideId = useEditorStore((s) => s.selectedLayoutGuideId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const selectLayoutGuide = useEditorStore((s) => s.selectLayoutGuide);

  if (editorMode !== "design") return null;
  if (layoutGuides.length === 0 && !draft) return null;

  const hitW = Math.max(layoutGuideHitThresholdWorld(zoom), 1);
  const lines = draft ? [...layoutGuides, { id: "__draft__", axis: draft.axis, pos: draft.pos }] : layoutGuides;

  const onGuidePointerDown = (guideId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectLayoutGuide(guideId);
  };

  return (
    <div className="absolute inset-0 z-[34] overflow-visible" aria-hidden={false}>
      <svg
        className="absolute left-0 top-0 overflow-visible"
        width={EXTENT}
        height={EXTENT}
        viewBox={`0 0 ${EXTENT} ${EXTENT}`}
      >
        {lines.map((g) => {
          const isDraft = g.id === "__draft__";
          const selected = !isDraft && g.id === selectedLayoutGuideId;
          const stroke = selected ? SELECTED_STROKE : STROKE;
          const visibleWidth = selected ? 2 : 1;
          const common = {
            stroke,
            vectorEffect: "non-scaling-stroke" as const,
            strokeDasharray: isDraft ? "4 4" : undefined,
          };

          if (g.axis === "v") {
            return (
              <g key={g.id}>
                <line
                  x1={g.pos}
                  y1={0}
                  x2={g.pos}
                  y2={EXTENT}
                  stroke="transparent"
                  strokeWidth={hitW}
                  className={isDraft ? "pointer-events-none" : "pointer-events-auto cursor-col-resize"}
                  onPointerDown={isDraft ? undefined : (e) => onGuidePointerDown(g.id, e)}
                />
                <line
                  x1={g.pos}
                  y1={0}
                  x2={g.pos}
                  y2={EXTENT}
                  pointerEvents="none"
                  strokeWidth={visibleWidth}
                  {...common}
                />
              </g>
            );
          }

          return (
            <g key={g.id}>
              <line
                x1={0}
                y1={g.pos}
                x2={EXTENT}
                y2={g.pos}
                stroke="transparent"
                strokeWidth={hitW}
                className={isDraft ? "pointer-events-none" : "pointer-events-auto cursor-row-resize"}
                onPointerDown={isDraft ? undefined : (e) => onGuidePointerDown(g.id, e)}
              />
              <line
                x1={0}
                y1={g.pos}
                x2={EXTENT}
                y2={g.pos}
                pointerEvents="none"
                strokeWidth={visibleWidth}
                {...common}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
