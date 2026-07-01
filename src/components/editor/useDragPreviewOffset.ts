"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getDragPreviewOffsetForIds,
  getDragPreviewSnapshot,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";

/** Live drag delta for overlays (text, handles) — matches SvgSceneRenderer drag preview. */
export function useDragPreviewOffset(nodeId: string): { dx: number; dy: number } {
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  return useMemo(
    () => getDragPreviewOffsetForIds([nodeId]),
    [nodeId, dragPreview],
  );
}
