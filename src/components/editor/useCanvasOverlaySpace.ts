"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import type { OverlaySpace } from "@/lib/canvasOverlaySpace";
import {
  getPanPreviewSnapshot,
  PAN_PREVIEW_IDLE,
  subscribePanPreview,
} from "@/lib/canvasEphemeralTransform";

/** Viewport-pixel overlays — handles stay crisp and constant size at any zoom. */
export function useCanvasOverlaySpace(): OverlaySpace {
  const pan = useEditorStore((s) => s.pan);
  const zoom = useEditorStore((s) => s.zoom);
  const panPreview = useSyncExternalStore(
    subscribePanPreview,
    getPanPreviewSnapshot,
    () => PAN_PREVIEW_IDLE,
  );
  return useMemo(
    () => ({
      screenSpace: true,
      pan: { x: pan.x + panPreview.dx, y: pan.y + panPreview.dy },
      zoom,
    }),
    [pan.x, pan.y, panPreview.dx, panPreview.dy, zoom],
  );
}
