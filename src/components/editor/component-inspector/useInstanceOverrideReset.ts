"use client";

import { useMemo } from "react";
import { findInstanceRoot } from "@/lib/componentModel";
import { hasStableOverride } from "@/lib/componentUx";
import { stableIdForInstanceNode } from "@/lib/components/stableIds";
import { useEditorStore } from "@/stores/useEditorStore";

export function useInstanceOverrideReset(nodeId: string, propertyPaths: string[]) {
  const nodes = useEditorStore((s) => s.nodes);
  const resetInstanceOverrides = useEditorStore((s) => s.resetInstanceOverrides);

  return useMemo(() => {
    const instRootId = findInstanceRoot(nodes, nodeId);
    if (!instRootId) {
      return { isInstanceLayer: false, hasOverride: false, reset: () => {} };
    }
    const root = nodes[instRootId];
    const stableId = stableIdForInstanceNode(root, nodeId);
    if (!stableId || !root) {
      return { isInstanceLayer: instRootId !== nodeId, hasOverride: false, reset: () => {} };
    }
    const hasOverride = propertyPaths.some((path) => hasStableOverride(root, stableId, path));
    return {
      isInstanceLayer: true,
      hasOverride,
      reset: () => {
        for (const path of propertyPaths) {
          if (hasStableOverride(root, stableId, path)) {
            resetInstanceOverrides(instRootId, stableId, path);
          }
        }
      },
      resetLayer: () => resetInstanceOverrides(instRootId, stableId),
    };
  }, [nodeId, nodes, propertyPaths, resetInstanceOverrides]);
}
