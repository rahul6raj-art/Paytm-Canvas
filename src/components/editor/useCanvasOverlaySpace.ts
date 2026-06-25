"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import type { OverlaySpace } from "@/lib/canvasOverlaySpace";
import { snapPanToDevicePixels } from "@/lib/crispRender";
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
  return useMemo(() => {
    const snappedPan = snapPanToDevicePixels(pan);
    return {
      screenSpace: true,
      pan: { x: snappedPan.x + panPreview.dx, y: snappedPan.y + panPreview.dy },
      zoom,
    };
  }, [pan.x, pan.y, panPreview.dx, panPreview.dy, zoom]);
}
