"use client";

import { useSyncExternalStore } from "react";
import {
  getDragPreviewSnapshot,
  getResizePreviewEpoch,
  subscribeDragPreview,
  subscribeResizePreview,
} from "@/lib/canvasEphemeralTransform";
import { SvgDomOverlays } from "./SvgDomOverlays";
import { SvgSceneRenderer } from "./SvgSceneRenderer";
import type { SceneRendererProps } from "./RendererTypes";

/**
 * Native renderer: WASM GPU compositor (underlay) + SVG scene for reliable visuals.
 * SVG rebuilds with drag/resize preview overlays; `NativeHitLayer` handles picking.
 */
export function SceneRenderer(props: SceneRendererProps) {
  const resizeOverlayActive = useSyncExternalStore(
    subscribeResizePreview,
    () => getResizePreviewEpoch() > 0,
    () => false,
  );
  const dragOverlayActive = useSyncExternalStore(
    subscribeDragPreview,
    () => Boolean(getDragPreviewSnapshot()?.movingIds.length),
    () => false,
  );
  const interactionPreviewActive = resizeOverlayActive || dragOverlayActive;

  return (
    <>
      <SvgSceneRenderer
        {...props}
        showDebugBadge={false}
        interactionPreview={interactionPreviewActive}
      />
      <SvgDomOverlays />
    </>
  );
}
