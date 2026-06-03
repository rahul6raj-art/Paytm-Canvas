"use client";

import { useEffect, useRef, useState } from "react";
import { isPointerOverSelection } from "@/lib/altMeasurements";
import { pickDeepestVisibleNodeAtWorldPoint } from "@/lib/tree";
import { useEditorStore } from "@/stores/useEditorStore";

type ClientToWorld = (clientX: number, clientY: number) => { x: number; y: number };

/** Tracks pointer vs selection while Option/Alt is held (Figma measure vs duplicate). */
export function useOptionPointerTracking(
  optionDown: boolean,
  editorMode: string,
  toWorld: ClientToWorld | null,
): { optionOverSelection: boolean; optionPointerHoverId: string | null } {
  const [optionOverSelection, setOptionOverSelection] = useState(false);
  const [optionPointerHoverId, setOptionPointerHoverId] = useState<string | null>(null);
  const lastClientRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const track = (e: PointerEvent) => {
      lastClientRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, []);

  useEffect(() => {
    if (!optionDown || editorMode !== "design") {
      setOptionOverSelection(false);
      setOptionPointerHoverId(null);
      return;
    }

    const clientToWorld: ClientToWorld =
      toWorld ??
      ((cx, cy) => {
        const st = useEditorStore.getState();
        const el = document.querySelector<HTMLElement>("[data-canvas-viewport]");
        if (!el) return { x: 0, y: 0 };
        const r = el.getBoundingClientRect();
        return {
          x: (cx - r.left - st.pan.x) / st.zoom,
          y: (cy - r.top - st.pan.y) / st.zoom,
        };
      });

    const sync = (clientX: number, clientY: number) => {
      const st = useEditorStore.getState();
      if (!st.selectedIds.length || (st.tool !== "move" && st.tool !== "frame")) {
        setOptionOverSelection(false);
        setOptionPointerHoverId(null);
        return;
      }
      const w = clientToWorld(clientX, clientY);
      setOptionOverSelection(isPointerOverSelection(w.x, w.y, st.selectedIds, st.nodes));
      setOptionPointerHoverId(
        pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder),
      );
    };

    const onMove = (e: PointerEvent) => sync(e.clientX, e.clientY);
    window.addEventListener("pointermove", onMove);
    sync(lastClientRef.current.x, lastClientRef.current.y);
    return () => window.removeEventListener("pointermove", onMove);
  }, [optionDown, editorMode, toWorld]);

  return { optionOverSelection, optionPointerHoverId };
}
