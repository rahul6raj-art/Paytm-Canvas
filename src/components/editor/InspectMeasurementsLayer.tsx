"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";
import { nearestAncestorFrameId } from "@/lib/inspectExport";

const LINE = "rgba(251, 113, 133, 0.95)";
const LABEL_BG = "rgba(15, 23, 42, 0.92)";
const LABEL_FG = "#fce7f3";

function DimLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div
      className="pointer-events-none absolute z-[1] whitespace-nowrap rounded px-1 py-0.5 font-mono text-[10px] font-medium leading-none shadow-sm"
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

  return (
    <div className="pointer-events-none absolute inset-0 z-[29] overflow-visible">
      {hwr && hoverId && (!swr || hoverId !== singleSel) && (
        <>
          <div
            className="absolute rounded-[1px] border border-dashed border-pink-400/90 shadow-[0_0_0_1px_rgba(15,23,42,0.2)]"
            style={{
              left: hwr.x,
              top: hwr.y,
              width: hwr.width,
              height: hwr.height,
            }}
          />
          <DimLabel x={hwr.x} y={hwr.y - 18} text={`${Math.round(hwr.width)} × ${Math.round(hwr.height)}`} />
        </>
      )}

      {swr && (
        <svg
          className="absolute left-0 top-0 overflow-visible"
          width={6000}
          height={6000}
          viewBox="0 0 6000 6000"
          aria-hidden
        >
          {dims.map((d) => (
            <g key={d.key}>
              <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={LINE} strokeWidth={1} />
            </g>
          ))}
        </svg>
      )}

      {swr &&
        dims.map((d) => (
          <DimLabel key={`lb-${d.key}`} x={d.mx} y={d.my} text={d.t} />
        ))}

      {swr ? (
        <DimLabel
          x={swr.x}
          y={swr.y - 18}
          text={`${Math.round(swr.width)} × ${Math.round(swr.height)}`}
        />
      ) : null}
    </div>
  );
}
