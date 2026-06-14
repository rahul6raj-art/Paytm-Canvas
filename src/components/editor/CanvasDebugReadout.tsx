"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isPaytmCraftDebugCanvas } from "@/lib/env";
import { isNativeRendererEnabled } from "@/lib/craftPublicConfig";
import { readCraftEngineDiagnostics, type CraftEngineDiagnostics } from "@/engine/craftEngineDiagnostics";
import { worldRect } from "@/lib/tree";
import { CANVAS_VIEWPORT_SELECTOR } from "@/lib/viewportZoom";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export function CanvasDebugReadout() {
  const enabled = isPaytmCraftDebugCanvas();
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [engine, setEngine] = useState<CraftEngineDiagnostics | null>(null);

  useEffect(() => {
    if (!enabled || !isNativeRendererEnabled()) {
      setEngine(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      void readCraftEngineDiagnostics().then((d) => {
        if (!cancelled) setEngine(d);
      });
    };
    poll();
    const id = window.setInterval(poll, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      const { pan: p, zoom: z } = useEditorStore.getState();
      const w = clientToWorldFromDocument(e.clientX, e.clientY, { pan: p, zoom: z });
      setCursor(w);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);

  if (!enabled) return null;

  let selRect = "—";
  if (selectedIds.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of selectedIds) {
      if (!nodes[id]?.visible) continue;
      const wr = worldRect(id, nodes);
      minX = Math.min(minX, wr.x);
      minY = Math.min(minY, wr.y);
      maxX = Math.max(maxX, wr.x + wr.width);
      maxY = Math.max(maxY, wr.y + wr.height);
    }
    if (Number.isFinite(minX)) {
      selRect = `${fmt(minX)},${fmt(minY)} ${fmt(maxX - minX)}×${fmt(maxY - minY)}`;
    }
  }

  const hasViewport = typeof document !== "undefined" && document.querySelector(CANVAS_VIEWPORT_SELECTOR);

  return (
    <div
      className="hidden min-w-0 flex-1 items-center justify-center gap-3 truncate font-mono text-ui text-app-subtle md:flex"
      title="Canvas debug (NEXT_PUBLIC_PAYTM_CRAFT_DEBUG_CANVAS=true)"
    >
      <span>zoom {fmt(zoom * 100, 0)}%</span>
      <span>pan {fmt(pan.x)},{fmt(pan.y)}</span>
      <span>cursor {fmt(cursor.x)},{fmt(cursor.y)}</span>
      <span>sel {selRect}</span>
      {!hasViewport ? <span className="text-amber-600">no viewport</span> : null}
      {engine?.ready ? (
        <>
          <span>gpu {engine.backend}</span>
          <span>v{engine.version ?? "?"}</span>
          <span>tiles {engine.tileCacheLen ?? 0}</span>
          <span>atlas {engine.atlasImageCount ?? 0}</span>
        </>
      ) : isNativeRendererEnabled() ? (
        <span className="text-amber-600">wasm pending</span>
      ) : null}
    </div>
  );
}
