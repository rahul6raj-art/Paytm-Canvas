"use client";

import { useMemo } from "react";
import { worldPointToOverlay, worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import { CANVAS_GUIDE_LINE_SCREEN_PX } from "@/lib/canvasVisual";
import { nearestAncestorFrameId } from "@/lib/inspectExport";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

const LINE = "rgba(251, 113, 133, 0.95)";
const LABEL_BG = "rgba(15, 23, 42, 0.92)";
const LABEL_FG = "#fce7f3";

function DimLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div
      className="pointer-events-none absolute z-[1] whitespace-nowrap rounded px-1 py-0.5 font-mono text-ui font-medium leading-none shadow-sm"
      style={{
        left: x,
        top: y,
        background: LABEL_BG,
        color: LABEL_FG,
        border: "1px solid rgba(251,113,133,0.35)",
      }}
    >
      {text}
    </div>
  );
}

export function InspectMeasurementsLayer() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const nodes = useEditorStore((s) => s.nodes);
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const overlay = useCanvasOverlaySpace();

  const geo = useMemo(() => {
    if (editorMode !== "inspect") return null;
    const hoverId = hoveredCanvasId;
    const hoverNode = hoverId ? nodes[hoverId] : null;
    const hwr =
      hoverNode?.visible && hoverId ? getNodeTransformedWorldBounds(hoverId, nodes) : null;

    const singleSel = selectedIds.length === 1 ? selectedIds[0]! : null;
    const selNode = singleSel ? nodes[singleSel] : null;
    const swr =
      selNode?.visible && singleSel ? getNodeTransformedWorldBounds(singleSel, nodes) : null;

    const parentFrameId =
      singleSel && selNode ? nearestAncestorFrameId(nodes, singleSel) : null;
    const pwr = parentFrameId ? getNodeTransformedWorldBounds(parentFrameId, nodes) : null;

    let dims: { key: string; x1: number; y1: number; x2: number; y2: number; mx: number; my: number; t: string }[] =
      [];
    if (swr && pwr && singleSel !== parentFrameId) {
      const nx = swr.x;
      const ny = swr.y;
      const nr = swr.x + swr.width;
      const nb = swr.y + swr.height;
      const fx = pwr.x;
      const fy = pwr.y;
      const fr = pwr.x + pwr.width;
      const fb = pwr.y + pwr.height;
      const cx = (nx + nr) / 2;
      const cy = (ny + nb) / 2;

      const left = Math.round(nx - fx);
      const top = Math.round(ny - fy);
      const right = Math.round(fr - nr);
      const bottom = Math.round(fb - nb);

      dims = [
        {
          key: "l",
          x1: fx,
          y1: cy,
          x2: nx,
          y2: cy,
          mx: (fx + nx) / 2,
          my: cy - 14,
          t: `${left}`,
        },
        {
          key: "t",
          x1: cx,
          y1: fy,
          x2: cx,
          y2: ny,
          mx: cx + 6,
          my: (fy + ny) / 2 - 8,
          t: `${top}`,
        },
        {
          key: "r",
          x1: nr,
          y1: cy,
          x2: fr,
          y2: cy,
          mx: (nr + fr) / 2,
          my: cy - 14,
          t: `${right}`,
        },
        {
          key: "b",
          x1: cx,
          y1: nb,
          x2: cx,
          y2: fb,
          mx: cx + 6,
          my: (nb + fb) / 2 - 8,
          t: `${bottom}`,
        },
      ];
    }

    return { hwr, swr, hoverId, dims, singleSel };
  }, [editorMode, hoveredCanvasId, nodes, selectedIds]);

  if (!geo) return null;

  const { hwr, swr, hoverId, dims, singleSel } = geo;
  const linePx = CANVAS_GUIDE_LINE_SCREEN_PX;
  const hoverScreen = hwr ? worldRectToOverlay(hwr, overlay) : null;
  const selScreen = swr ? worldRectToOverlay(swr, overlay) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[29] overflow-visible">
      {hoverScreen && hoverId && (!swr || hoverId !== singleSel) && (
        <>
          <div
            className="absolute rounded-[1px] border border-dashed border-pink-400/90 shadow-[0_0_0_1px_rgba(15,23,42,0.2)]"
            style={{
              left: hoverScreen.x,
              top: hoverScreen.y,
              width: hoverScreen.width,
              height: hoverScreen.height,
            }}
          />
          <DimLabel
            x={hoverScreen.x}
            y={hoverScreen.y - 18}
            text={`${Math.round(hwr!.width)} × ${Math.round(hwr!.height)}`}
          />
        </>
      )}

      {selScreen && (
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {dims.map((d) => {
            const a = worldPointToOverlay(d.x1, d.y1, overlay);
            const b = worldPointToOverlay(d.x2, d.y2, overlay);
            return (
              <line
                key={d.key}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={LINE}
                strokeWidth={linePx}
              />
            );
          })}
        </svg>
      )}

      {selScreen &&
        dims.map((d) => {
          const label = worldPointToOverlay(d.mx, d.my, overlay);
          return <DimLabel key={`lb-${d.key}`} x={label.x} y={label.y} text={d.t} />;
        })}

      {selScreen ? (
        <DimLabel
          x={selScreen.x}
          y={selScreen.y - 18}
          text={`${Math.round(swr!.width)} × ${Math.round(swr!.height)}`}
        />
      ) : null}
    </div>
  );
}
