"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isCanvasComponentDrag } from "@/lib/canvasImageImport";
import { CANVAS_OUTLINE_SCREEN_PX, CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { resolveInstanceDropParentId } from "@/lib/slotEditScope";
import { pickDeepestVisibleNodeAtWorldPoint, worldRect } from "@/lib/tree";
import { useCanvasToWorld } from "./CanvasToWorldContext";

export function ComponentPlacementPreview() {
  const masterId = useEditorStore((s) => s.placingComponentMasterId);
  const activeSlotEdit = useEditorStore((s) => s.activeSlotEdit);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
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
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !isCanvasComponentDrag(e.dataTransfer)) return;
      e.preventDefault();
      setHover(toWorld(e.clientX, e.clientY));
    };
    const clearHover = () => setHover(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", clearHover);
    window.addEventListener("dragend", clearHover);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", clearHover);
      window.removeEventListener("dragend", clearHover);
      setHover(null);
    };
  }, [masterId, toWorld]);

  const dropTarget = useMemo(() => {
    if (!hover) return null;
    return resolveInstanceDropParentId(
      nodes,
      childOrder,
      activeSlotEdit,
      hover.x,
      hover.y,
      (x, y) => pickDeepestVisibleNodeAtWorldPoint(x, y, nodes, childOrder),
    );
  }, [activeSlotEdit, childOrder, hover, nodes]);

  if (!masterId || !hover) return null;
  const master = nodes[masterId];
  if (!master) return null;

  const w = master.width;
  const h = master.height;
  const x = hover.x - w / 2;
  const y = hover.y - h / 2;
  const border = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const inActiveSlot =
    activeSlotEdit != null &&
    dropTarget === activeSlotEdit.containerId;
  const inAnySlot = dropTarget != null;
  const invalidActiveSlotDrop =
    activeSlotEdit != null && !inActiveSlot;
  const borderColor = invalidActiveSlotDrop
    ? "#ef4444"
    : inAnySlot
      ? CANVAS_VISUAL.instance
      : CANVAS_VISUAL.instance;
  const background = invalidActiveSlotDrop
    ? "rgba(239, 68, 68, 0.08)"
    : inAnySlot
      ? "rgba(139, 92, 246, 0.16)"
      : "rgba(139, 92, 246, 0.1)";

  const slotHighlight =
    dropTarget != null ? (
      (() => {
        const rect = worldRect(dropTarget, nodes);
        const pad = screenPxToWorld(2, zoom);
        const slotBorder = screenPxToWorld(1, zoom);
        return (
          <div
            className="pointer-events-none absolute z-[16] box-border rounded-sm"
            style={{
              left: rect.x - pad,
              top: rect.y - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              borderWidth: slotBorder,
              borderStyle: invalidActiveSlotDrop ? "solid" : "dashed",
              borderColor: invalidActiveSlotDrop ? "#ef4444" : "rgba(139, 92, 246, 0.75)",
              background: inActiveSlot || inAnySlot ? "rgba(167, 139, 250, 0.14)" : undefined,
            }}
            data-testid="slot-drop-highlight"
            aria-hidden
          />
        );
      })()
    ) : null;

  return (
    <>
      {slotHighlight}
      <div
        className="pointer-events-none absolute z-[17] box-border border-dashed opacity-90"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          borderWidth: border,
          borderColor,
          background,
        }}
        aria-hidden
      />
    </>
  );
}
