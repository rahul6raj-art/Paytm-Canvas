"use client";

import { useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { activateCanvasForShortcuts, isEditableFieldElement } from "@/lib/editorKeyboardFocus";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import { CanvasInspector } from "./CanvasInspector";
import { DesignInspector } from "./DesignInspector";
import { VectorInspector } from "./VectorInspector";
import { MultiSelectionInspector } from "./MultiSelectionInspector";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { PrototypeInspector } from "./PrototypeInspector";
import { findPrototypeLinkOwner } from "@/lib/prototype";
import { InspectInspector } from "./InspectInspector";
import { FigmaFidelityInspector } from "./FigmaFidelityInspector";
import { ResponsivePreviewPanel } from "./ResponsivePreviewPanel";
import { CodePanel } from "./CodePanel";
import { EditorModeTabs } from "./EditorModeTabs";
import { RightPanelQuickTools } from "./RightPanelQuickTools";
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

  const onPanelPointerDownCapture = (e: ReactPointerEvent) => {
    if (!isEditableFieldElement(e.target)) {
      activateCanvasForShortcuts();
    }
  };

  return (
    <div
      data-right-properties-panel
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-app-panel-edge bg-chrome-panel shadow-app-panel"
      onPointerDownCapture={onPanelPointerDownCapture}
    >
      <div className="shrink-0 bg-app-panel">
        <EditorModeTabs variant="underline" stretch />

        {editorMode === "design" ? (
          <div className="flex items-center gap-3 px-3 pb-2.5 pt-1">
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
                    "text-ui font-medium transition-colors",
                    rightPanelTab === id ? "text-app-fg" : "text-app-subtle hover:text-app-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <RightPanelQuickTools />
          </div>
        ) : (
          <div className="px-3 pb-2.5 pt-1 text-ui text-app-subtle">Properties</div>
        )}
      </div>

      {editorMode === "design" && rightPanelTab === "code" && <CodePanel />}

      {editorMode === "design" && rightPanelTab === "design" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto" data-inspector-panel>
            {!node ? (
              selectedIds.length > 0 ? (
                <MultiSelectionInspector
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
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto" data-inspector-panel>
          {!prototypeContextNode ? (
            <div className="px-3 py-4 inspector-helper-text">
              Select a layer to edit prototype interactions, or wire from the blue handle on the canvas.
            </div>
          ) : (
            <PrototypeInspector node={prototypeContextNode} />
          )}
        </div>
      )}

      {editorMode === "inspect" && (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto" data-inspector-panel>
          {!node || selectedIds.length > 1 ? (
            <div className="px-3 py-4 inspector-helper-text">Select a layer to inspect</div>
          ) : (
            <div className="px-3 py-3 space-y-3">
              <InspectInspector node={node} />
              <FigmaFidelityInspector node={node} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
