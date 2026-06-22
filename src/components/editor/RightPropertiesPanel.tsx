"use client";

import { useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { activateCanvasForShortcuts, isEditableFieldElement } from "@/lib/editorKeyboardFocus";
import { useEditorStore } from "@/stores/useEditorStore";
import { CanvasInspector } from "./CanvasInspector";
import { DesignInspector } from "./DesignInspector";
import { SelectionDesignInspector } from "./SelectionDesignInspector";
import { VectorInspector } from "./VectorInspector";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { PrototypeInspector } from "./PrototypeInspector";
import { findPrototypeLinkOwner } from "@/lib/prototype";
import { InspectInspector } from "./InspectInspector";
import { FigmaFidelityInspector } from "./FigmaFidelityInspector";
import { ResponsivePreviewPanel } from "./ResponsivePreviewPanel";
import { CodePanel } from "./CodePanel";
import { EditorModeTabs } from "./EditorModeTabs";
import { RightPanelQuickTools } from "./RightPanelQuickTools";
import { CanvasZoomControls } from "./CanvasFloatingZoom";
import { cn } from "@/lib/utils";
import { EditorHintPolicyProvider } from "./EditorHoverHint";

export function RightPropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const editorMode = useEditorStore((s) => s.editorMode);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);
  const setRightPanelTab = useEditorStore((s) => s.setRightPanelTab);
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
    <EditorHintPolicyProvider policy="none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <div
          data-right-properties-panel
          className="editor-sidebar-section pointer-events-auto flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          onPointerDownCapture={onPanelPointerDownCapture}
        >
          <div className="shrink-0 border-b border-app-panel-edge px-3.5 py-2.5">
            <EditorModeTabs variant="segmented" stretch />

            {editorMode === "design" ? (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {(
                    [
                      ["design", "Properties"],
                      ["code", "Code"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRightPanelTab(id)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-ui font-medium transition-colors",
                        rightPanelTab === id
                          ? "bg-app-hover text-app-fg"
                          : "text-app-subtle hover:bg-app-hover hover:text-app-fg",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <RightPanelQuickTools />
              </div>
            ) : (
              <div className="pt-2 text-ui text-app-subtle">Prototype & motion</div>
            )}
          </div>

          {editorMode === "design" && rightPanelTab === "code" && <CodePanel />}

          {editorMode === "design" && rightPanelTab === "design" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto" data-inspector-panel>
                {selectedIds.length === 0 ? (
                  <CanvasInspector />
                ) : selectedIds.length > 1 ? (
                  <SelectionDesignInspector />
                ) : !node ? (
                  <CanvasInspector />
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
                <div className="space-y-3 px-3 py-3">
                  <InspectInspector node={node} />
                  <FigmaFidelityInspector node={node} />
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="editor-sidebar-section pointer-events-auto shrink-0 px-3.5 py-2.5"
          data-canvas-view-controls
        >
          <CanvasZoomControls />
        </div>
      </div>
    </EditorHintPolicyProvider>
  );
}
