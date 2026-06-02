"use client";

import { useMemo } from "react";
import { alignableSelectionIds } from "@/lib/alignSelection";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import { CanvasInspector } from "./CanvasInspector";
import { DesignInspector } from "./DesignInspector";
import { VectorInspector } from "./VectorInspector";
import { InspectorEmptyState } from "./InspectorEmptyState";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { PrototypeInspector } from "./PrototypeInspector";
import { findPrototypeLinkOwner } from "@/lib/prototype";
import { InspectInspector } from "./InspectInspector";
import { ResponsivePreviewPanel } from "./ResponsivePreviewPanel";
import { CodePanel } from "./CodePanel";
import { cn } from "@/lib/utils";

export function RightPropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const editorMode = useEditorStore((s) => s.editorMode);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);
  const setRightPanelTab = useEditorStore((s) => s.setRightPanelTab);
  const addAutoLayoutToSelection = useEditorStore((s) => s.addAutoLayoutToSelection);
  const canAutoLayout = useMemo(
    () => canAddAutoLayoutToSelection(selectedIds, nodes),
    [selectedIds, nodes],
  );
  const alignableCount = useMemo(
    () => alignableSelectionIds(selectedIds, nodes).length,
    [selectedIds, nodes],
  );
  const selectedPrototypeLinkId = useEditorStore((s) => s.selectedPrototypeLinkId);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);

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
    <div className="flex h-full min-h-0 flex-col border-l border-app-border bg-chrome-panel shadow-app-panel">
      <div className="flex h-8 shrink-0 items-center border-b border-app-border bg-app-inset">
        {editorMode === "design" ? (
          <div className="flex h-full w-full items-stretch px-1">
            {(
              [
                ["design", "Design"],
                ["code", "Code"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightPanelTab(id)}
                className={cn(
                  "flex flex-1 items-center justify-center text-[11px] font-semibold tracking-wide transition-colors",
                  rightPanelTab === id
                    ? "text-app-fg after:absolute relative after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-accent"
                    : "text-app-subtle hover:text-app-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-3 text-[11px] font-semibold capitalize tracking-wide text-app-muted">
            {editorMode === "prototype" ? "Prototype" : "Inspect"}
            <span className="ml-1.5 text-app-subtle">· Properties</span>
          </span>
        )}
      </div>

      {editorMode === "design" && rightPanelTab === "code" && <CodePanel />}

      {editorMode === "design" && rightPanelTab === "design" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {!node ? (
              selectedIds.length > 0 ? (
                <InspectorEmptyState
                  multi
                  count={alignableCount}
                  selectedCount={selectedIds.length}
                  canAddAutoLayout={canAutoLayout}
                  onAddAutoLayout={() => addAutoLayoutToSelection()}
                />
              ) : (
                <CanvasInspector />
              )
            ) : pathEditModeNodeId && singleId === pathEditModeNodeId && node.type === "path" ? (
              <VectorInspector node={node} />
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
            <div className="p-3 text-[12px] leading-relaxed text-app-subtle">
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
            <div className="p-3 text-[12px] leading-relaxed text-app-subtle">
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
