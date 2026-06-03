"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_OUTLINE_SCREEN_PX, CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { useCanvasToWorld } from "./CanvasToWorldContext";

export function ComponentPlacementPreview() {
  const masterId = useEditorStore((s) => s.placingComponentMasterId);
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);
  const toWorld = useCanvasToWorld();
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!masterId || !toWorld) {
      setHover(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      setHover(toWorld(e.clientX, e.clientY));
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      setHover(null);
    };
  }, [masterId, toWorld]);

  if (!masterId || !hover) return null;
  const master = nodes[masterId];
  if (!master) return null;

  const w = master.width;
  const h = master.height;
  const x = hover.x - w / 2;
  const y = hover.y - h / 2;
  const border = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);

  return (
    <div
      className="pointer-events-none absolute z-[17] box-border border-dashed opacity-90"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        borderWidth: border,
        borderColor: CANVAS_VISUAL.instance,
        background: "rgba(139, 92, 246, 0.08)",
      }}
      aria-hidden
    />
  );
}
