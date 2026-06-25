"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_OUTLINE_SCREEN_PX, CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { worldRect } from "@/lib/tree";

/** Dashed purple boundary around each component set container (Figma-style). */
export function ComponentVariantSetBoundary() {
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);

  const setContainers = useMemo(
    () => Object.values(nodes).filter((n) => n.isComponentSet && n.visible),
    [nodes],
  );

  if (setContainers.length === 0) return null;

  const pad = 8;
  const border = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);

  return (
    <>
      {setContainers.map((container) => {
        const bounds = worldRect(container.id, nodes);
        return (
          <div
            key={container.id}
            className="pointer-events-none absolute z-[16] box-border rounded-sm border-dashed"
            style={{
              left: bounds.x - pad,
              top: bounds.y - pad,
              width: bounds.width + pad * 2,
              height: bounds.height + pad * 2,
              borderWidth: border,
              borderColor: CANVAS_VISUAL.instance,
            }}
            aria-hidden
            data-testid="component-variant-set-boundary"
            data-set-id={container.id}
          />
        );
      })}
    </>
  );
}
