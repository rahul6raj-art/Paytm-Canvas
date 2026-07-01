"use client";

import { useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import type { OverlaySpace } from "@/lib/canvasOverlaySpace";
import {
  getEffectiveViewportSnapshot,
  subscribeViewportPreview,
} from "@/lib/canvasEphemeralTransform";

/** Viewport-pixel overlays — handles stay crisp and constant size at any zoom. */
export function useCanvasOverlaySpace(): OverlaySpace {
  const pan = useEditorStore((s) => s.pan);
  const zoom = useEditorStore((s) => s.zoom);
  useSyncExternalStore(subscribeViewportPreview, getEffectiveViewportSnapshot, () => ({
    pan,
    zoom,
  }));
  const effective = getEffectiveViewportSnapshot();
  return {
    screenSpace: true,
    pan: effective.pan,
    zoom: effective.zoom,
  };
}
