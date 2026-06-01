"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CanvasInspector } from "./CanvasInspector";
import { DesignInspector } from "./DesignInspector";
import { InspectorEmptyState } from "./InspectorEmptyState";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { PrototypeInspector } from "./PrototypeInspector";
import { findPrototypeLinkOwner } from "@/lib/prototype";
import { InspectInspector } from "./InspectInspector";
import { ResponsivePreviewPanel } from "./ResponsivePreviewPanel";

export function RightPropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const editorMode = useEditorStore((s) => s.editorMode);
  const selectedPrototypeLinkId = useEditorStore((s) => s.selectedPrototypeLinkId);

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const node = useMemo(() => {
    if (!singleId) return null;
    const raw = nodes[singleId];
    return raw ? mergeInstanceOverrides(raw, nodes) : null;
  }, [singleId, nodes]);

  const prototypeContextNode = useMemo(() => {
    if (editorMode !== "prototype") return null;
    if (selectedPrototypeLinkId) {
      const own = findPrototypeLinkOwner(nodes, selectedPrototypeLinkId);
      if (own?.ownerId && nodes[own.ownerId]) {
        return mergeInstanceOverrides(nodes[own.ownerId]!, nodes);
      }
    }
    return node;
  }, [editorMode, node, nodes, selectedPrototypeLinkId]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-black/30 bg-chrome-panel shadow-panel">
      <div className="flex h-8 shrink-0 items-center border-b border-black/30 bg-[#383838] px-3">
        <span className="text-[11px] font-semibold capitalize tracking-wide text-[#c4c4c4]">
          {editorMode === "design" ? "Design" : editorMode === "prototype" ? "Prototype" : "Inspect"}
        </span>
        <span className="ml-1.5 text-[11px] text-[#6b6b6b]">· Properties</span>
      </div>

      {editorMode === "design" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {!node ? (
              selectedIds.length > 0 ? (
                <InspectorEmptyState multi count={selectedIds.length} />
              ) : (
                <CanvasInspector />
              )
            ) : (
              <DesignInspector node={node} />
            )}
          </div>
          <ResponsivePreviewPanel />
        </div>
      )}

      {editorMode === "prototype" && (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {!prototypeContextNode ? (
            <div className="p-3 text-[12px] leading-relaxed text-[#8c8c8c]">
              Select a layer to edit prototype interactions, or wire from the blue handle on the canvas.
            </div>
          ) : (
            <PrototypeInspector node={prototypeContextNode} />
          )}
        </div>
      )}

      {editorMode === "inspect" && (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {!node || selectedIds.length > 1 ? (
            <div className="p-3 text-[12px] leading-relaxed text-[#8c8c8c]">
              Select a layer to inspect
            </div>
          ) : (
            <InspectInspector node={node} />
          )}
        </div>
      )}
    </div>
  );
}
