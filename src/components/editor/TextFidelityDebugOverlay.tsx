"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import { getFontWarnings } from "@/lib/text/textFontManager";
import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { matrixToCssTransform } from "@/lib/transformMath";
import { autoResizeToTextResizeMode } from "@/lib/text/autoResizeMode";

function readTextDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("textDebug") === "1";
}

function subscribeTextDebug(_onStoreChange: () => void): () => void {
  return () => {};
}

/** Dev overlay: glyph boxes, line boxes, baselines, caret stops, font warnings. Enable with ?textDebug=1 */
export function TextFidelityDebugOverlay() {
  const enabled = useSyncExternalStore(subscribeTextDebug, readTextDebugEnabled, () => false);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);

  const overlays = useMemo(() => {
    if (!enabled) return [];
    const warnings = getFontWarnings();
    const out: Array<{
      nodeId: string;
      transform: string;
      width: number;
      height: number;
      textResizeMode: string;
      autoResize: string;
      lineCount: number;
      availableWidth: number;
      wrapEnabled: boolean;
      cacheKey: string;
      lineWidths: number[];
      lines: Array<{ x: number; y: number; w: number; h: number }>;
      glyphs: Array<{ x: number; y: number; w: number; h: number }>;
      caretStops: Array<{ x: number; y: number }>;
      label: string;
    }> = [];

    for (const node of Object.values(nodes)) {
      if (node.type !== "text" || node.visible === false) continue;
      const prepared = textLayoutForEditorNode(node);
      if (!prepared) continue;
      const { canonical, debug } = prepared;
      const wm = getNodeWorldMatrixFromChildOrder(node.id, nodes, childOrder);
      const warning = warnings.find((w) => w.nodeId === node.id);
      const label = warning
        ? `${warning.requestedFamily} → ${warning.resolvedFamily}${warning.missing ? " (missing)" : ""}`
        : `${canonical.font.requestedFamily} [${canonical.source}]`;

      out.push({
        nodeId: node.id,
        transform: wm ? matrixToCssTransform(wm) : `translate(${node.x}px, ${node.y}px)`,
        width: node.width,
        height: node.height,
        textResizeMode: node.textResizeMode ?? "auto-width",
        autoResize: node.autoResize ?? autoResizeToTextResizeMode(node.textResizeMode),
        lineCount: prepared.layout.lines.length,
        availableWidth: debug.availableWidth,
        wrapEnabled: debug.wrapEnabled,
        cacheKey: debug.cacheKey,
        lineWidths: debug.lineWidths,
        lines: canonical.lines.map((line) => ({
          x: line.x,
          y: line.y,
          w: line.width,
          h: canonical.lineHeightPx,
        })),
        glyphs: canonical.glyphs.map((g) => ({
          x: g.x,
          y: g.y,
          w: g.width,
          h: g.height,
        })),
        caretStops: canonical.caretStops.map((c) => ({ x: c.x, y: c.y })),
        label,
      });
    }
    return out;
  }, [enabled, nodes, childOrder]);

  if (!enabled || overlays.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden" aria-hidden>
      {overlays.map((o) => (
        <div
          key={o.nodeId}
          className="absolute left-0 top-0"
          style={{
            width: o.width,
            height: o.height,
            transform: o.transform,
            transformOrigin: "0 0",
          }}
        >
          {o.lines.map((line, i) => (
            <div
              key={`line-${i}`}
              className="absolute border border-dashed border-[#22c55e]/80 bg-[#22c55e]/10"
              style={{ left: line.x, top: line.y, width: line.w, height: line.h }}
            />
          ))}
          {o.glyphs.map((g, i) => (
            <div
              key={`glyph-${i}`}
              className="absolute border border-[#f59e0b]/70"
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
            />
          ))}
          {o.caretStops.map((c, i) => (
            <div
              key={`caret-${i}`}
              className="absolute h-2 w-0.5 bg-[#18a0fb]"
              style={{ left: c.x, top: c.y }}
            />
          ))}
          <div
            className="absolute left-0 top-0 max-w-[min(100%,320px)] bg-[#0f172a]/90 px-1.5 py-1 text-[9px] leading-snug text-white"
            style={{ transform: "translateY(-100%)" }}
          >
            <div>{o.label}</div>
            <div className="tabular-nums text-[#94a3b8]">
              {o.width}×{o.height} · {o.textResizeMode}/{o.autoResize} · {o.lineCount} lines · wrap=
              {o.wrapEnabled ? "on" : "off"} · avail={Math.round(o.availableWidth)}
            </div>
            <div className="truncate text-[#64748b]" title={o.cacheKey}>
              widths: [{o.lineWidths.map((w) => Math.round(w)).join(", ")}]
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
