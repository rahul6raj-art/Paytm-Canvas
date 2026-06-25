"use client";

import { findDeepestInteractiveInstanceRoot } from "@/lib/components/stablePaths";
import type { ComponentInteractionTrigger } from "@/lib/components/componentInteractions";
import { useEditorStore } from "@/stores/useEditorStore";

/** Route canvas pointer events to interactive component variant switching in preview mode. */
export function useComponentInteractionPreview(nodeId: string) {
  const componentInteractionPreview = useEditorStore((s) => s.componentInteractionPreview);
  const triggerInstanceInteraction = useEditorStore((s) => s.triggerInstanceInteraction);

  const dispatch = (trigger: ComponentInteractionTrigger) => {
    const st = useEditorStore.getState();
    if (!st.componentInteractionPreview) return;
    const instRoot = findDeepestInteractiveInstanceRoot(st.nodes, nodeId);
    if (!instRoot) return;
    triggerInstanceInteraction(instRoot, trigger);
  };

  if (!componentInteractionPreview) {
    return {
      previewActive: false as const,
      onPreviewPointerEnter: undefined,
      onPreviewPointerLeave: undefined,
      onPreviewPointerDown: undefined,
      onPreviewPointerUp: undefined,
    };
  }

  return {
    previewActive: true as const,
    onPreviewPointerEnter: (e: React.PointerEvent) => {
      e.stopPropagation();
      dispatch("ON_MOUSE_ENTER");
    },
    onPreviewPointerLeave: (e: React.PointerEvent) => {
      e.stopPropagation();
      dispatch("ON_MOUSE_LEAVE");
    },
    onPreviewPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dispatch("ON_PRESS");
    },
    onPreviewPointerUp: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dispatch("ON_RELEASE");
    },
  };
}
