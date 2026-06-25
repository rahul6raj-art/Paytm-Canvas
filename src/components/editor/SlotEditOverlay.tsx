"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { findSlotPropertyForHit, resolveSlotEditScope } from "@/lib/slotEditScope";
import { worldRect } from "@/lib/tree";
import { CANVAS_OUTLINE_SCREEN_PX, CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";

/** Purple dashed outline + label while editing a component slot. */
export function SlotEditOverlay() {
  const activeSlotEdit = useEditorStore((s) => s.activeSlotEdit);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);

  const scope = useMemo(() => {
    if (!activeSlotEdit) return null;
    return resolveSlotEditScope(
      nodes,
      childOrder,
      activeSlotEdit.instanceRootId,
      activeSlotEdit.propertyKey,
    );
  }, [activeSlotEdit, nodes, childOrder]);

  if (!activeSlotEdit || !scope) return null;

  const rect = worldRect(scope.containerId, nodes);
  if (!rect) return null;

  const pad = screenPxToWorld(4, zoom);
  const border = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX + 1, zoom);

  return (
    <>
      <div
        className="pointer-events-none absolute z-[17] box-border rounded-sm border-dashed"
        style={{
          left: rect.x - pad,
          top: rect.y - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderWidth: border,
          borderColor: CANVAS_VISUAL.instance,
          boxShadow: `0 0 0 ${screenPxToWorld(9999, zoom)}px rgba(0,0,0,0.08)`,
        }}
        data-testid="slot-edit-overlay"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute z-[18] rounded-md px-2 py-0.5 text-[11px] font-medium text-violet-100"
        style={{
          left: rect.x,
          top: rect.y - screenPxToWorld(22, zoom),
          background: "rgba(124, 58, 237, 0.92)",
        }}
        data-testid="slot-edit-label"
      >
        Editing slot: {scope.label}
      </div>
    </>
  );
}

/** Faint purple outline on slot containers when hovering an instance (not actively editing). */
export function SlotHoverOutline() {
  const activeSlotEdit = useEditorStore((s) => s.activeSlotEdit);
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);

  const scope = useMemo(() => {
    if (activeSlotEdit || !hoveredCanvasId) return null;
    return findSlotPropertyForHit(nodes, childOrder, hoveredCanvasId);
  }, [activeSlotEdit, hoveredCanvasId, nodes, childOrder]);

  if (!scope) return null;

  const rect = worldRect(scope.containerId, nodes);
  if (!rect) return null;

  const pad = screenPxToWorld(2, zoom);
  const border = screenPxToWorld(1, zoom);

  return (
    <div
      className="pointer-events-none absolute z-[15] box-border rounded-sm border-dashed opacity-70"
      style={{
        left: rect.x - pad,
        top: rect.y - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderWidth: border,
        borderColor: "rgba(167, 139, 250, 0.55)",
      }}
      data-testid="slot-hover-outline"
      aria-hidden
    />
  );
}
