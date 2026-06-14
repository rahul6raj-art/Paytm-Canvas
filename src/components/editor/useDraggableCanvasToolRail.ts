"use client";

import {
  clampCanvasToolRailPosition,
  readCanvasToolRailPosition,
  writeCanvasToolRailPosition,
  type CanvasToolRailPosition,
} from "@/lib/canvasToolRail";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

type RailDimensions = {
  rail: { width: number; height: number };
  workspace: { width: number; height: number };
};

function resolveRailDimensions(rail: HTMLDivElement | null): RailDimensions | null {
  const workspace = rail?.closest("[data-canvas-workspace]") as HTMLElement | null;
  if (!rail || !workspace) return null;
  return {
    rail: { width: rail.offsetWidth, height: rail.offsetHeight },
    workspace: { width: workspace.clientWidth, height: workspace.clientHeight },
  };
}

function readRailPositionFromDom(rail: HTMLDivElement): CanvasToolRailPosition | null {
  const workspace = rail.closest("[data-canvas-workspace]") as HTMLElement | null;
  if (!workspace) return null;
  const railRect = rail.getBoundingClientRect();
  const wsRect = workspace.getBoundingClientRect();
  return {
    left: railRect.left - wsRect.left,
    top: railRect.top - wsRect.top,
  };
}

/** Drag the bottom canvas tool rail anywhere inside the workspace (Figma-style). */
export function useDraggableCanvasToolRail(railRef: RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<CanvasToolRailPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const restoredRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    railWidth: number;
    railHeight: number;
    workspaceWidth: number;
    workspaceHeight: number;
  } | null>(null);

  const measure = useCallback((): RailDimensions | null => {
    return resolveRailDimensions(railRef.current);
  }, [railRef]);

  const clampToWorkspace = useCallback(
    (pos: CanvasToolRailPosition, dims: RailDimensions): CanvasToolRailPosition =>
      clampCanvasToolRailPosition(
        pos.left,
        pos.top,
        dims.rail.width,
        dims.rail.height,
        dims.workspace,
      ),
    [],
  );

  // Restore only user-dragged positions; default stays CSS bottom-center until first drag.
  useLayoutEffect(() => {
    if (restoredRef.current) return;
    const stored = readCanvasToolRailPosition();
    if (!stored) return;
    const dims = measure();
    if (!dims) return;
    restoredRef.current = true;
    setPosition(clampToWorkspace(stored, dims));
  }, [clampToWorkspace, measure]);

  useEffect(() => {
    const workspace = railRef.current?.closest("[data-canvas-workspace]") as HTMLElement | null;
    if (!workspace) return;

    const ro = new ResizeObserver(() => {
      const dims = measure();
      if (!dims) return;
      setPosition((prev) => (prev ? clampToWorkspace(prev, dims) : prev));
    });
    ro.observe(workspace);
    return () => ro.disconnect();
  }, [clampToWorkspace, measure, railRef]);

  const onRailPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;

      const rail = railRef.current;
      const dims = measure();
      if (!rail || !dims) return;

      e.preventDefault();
      e.stopPropagation();

      const current =
        position ??
        readRailPositionFromDom(rail) ??
        ({ left: 0, top: 0 } satisfies CanvasToolRailPosition);

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originLeft: current.left,
        originTop: current.top,
        railWidth: dims.rail.width,
        railHeight: dims.rail.height,
        workspaceWidth: dims.workspace.width,
        workspaceHeight: dims.workspace.height,
      };
      setIsDragging(true);
      setPosition(current);

      const onMove = (ev: globalThis.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        setPosition(
          clampCanvasToolRailPosition(
            drag.originLeft + (ev.clientX - drag.startX),
            drag.originTop + (ev.clientY - drag.startY),
            drag.railWidth,
            drag.railHeight,
            { width: drag.workspaceWidth, height: drag.workspaceHeight },
          ),
        );
      };

      const end = (ev: globalThis.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        setPosition((prev) => {
          if (prev) writeCanvasToolRailPosition(prev);
          return prev;
        });
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [measure, position, railRef],
  );

  return { position, onRailPointerDown, isDragging };
}
