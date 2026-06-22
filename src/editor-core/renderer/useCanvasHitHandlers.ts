"use client";

import { useCallback } from "react";
import { enterTextEditModeAtWorldPoint } from "@/lib/text/textEditMode";
import { beginCanvasNodeDrag, type ClientToWorldFn } from "@/lib/canvasNodeDrag";
import { prepareAltDragDuplicate } from "@/lib/canvasAltDrag";
import {
  canCanvasObjectDrag,
  canCanvasObjectInteract,
  isCanvasSelectTool,
} from "@/lib/canvasInteractionGuards";
import { useCanvasInteraction } from "@/components/editor/CanvasInteractionContext";
import {
  applyMoveToolPointerSelection,
  drillTargetForDoubleClick,
  isAdditiveSelectionClick,
  isDeepSelectClick,
  selectionTargetForClick,
} from "@/lib/containerSelection";
import {
  canEnterParametricShapeEdit,
  shouldEnterPathEditOnEdit,
} from "@/lib/editMode/shapeEditGate";
import { activateCanvasForShortcuts } from "@/lib/editorKeyboardFocus";
import { pickDeepestNodeAtWorldPoint } from "@/lib/tree";
import { useEditorStore } from "@/stores/useEditorStore";

export function useCanvasHitHandlers(clientToWorld: ClientToWorldFn) {
  const { spaceDown, panning: canvasPanning, commandDown } = useCanvasInteraction();

  const onEnter = useCallback(
    (nodeId: string) => {
      const st = useEditorStore.getState();
      if (st.editingTextId || st.pathEditModeNodeId) return;
      const n = st.nodes[nodeId];
      if (!n?.visible) return;
      const hoverId = selectionTargetForClick(
        nodeId,
        st.nodes,
        st.childOrder,
        st.objectEditModeNodeId,
        commandDown,
      );
      if (st.editorMode === "inspect") {
        st.setHoveredCanvasId(hoverId);
        return;
      }
      if (!st.nodes[hoverId]?.locked) st.setHoveredCanvasId(hoverId);
    },
    [commandDown],
  );

  const onLeave = useCallback((nodeId: string) => {
    const st = useEditorStore.getState();
    if (st.hoveredCanvasId === nodeId) st.setHoveredCanvasId(null);
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const st = useEditorStore.getState();
    const n = st.nodes[nodeId];
    if (!n?.visible) return;
    const targetId = selectionTargetForClick(
      nodeId,
      st.nodes,
      st.childOrder,
      st.objectEditModeNodeId,
      isDeepSelectClick(e),
    );
    st.openContextMenu(targetId, e.clientX, e.clientY);
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const st = useEditorStore.getState();
      const node = st.nodes[nodeId];
      if (!node?.visible || node.locked) return;
      if (st.editorMode === "inspect") return;

      if (st.pathEditModeNodeId && st.pathEditModeNodeId !== nodeId) {
        st.setPathEditMode(null);
      }

      const w = clientToWorld(e.clientX, e.clientY);
      const drill = drillTargetForDoubleClick(
        nodeId,
        w.x,
        w.y,
        st.nodes,
        st.childOrder,
        st.objectEditModeNodeId,
        (x, y) => pickDeepestNodeAtWorldPoint(x, y, st.nodes, st.childOrder),
      );
      if (drill) {
        st.enterObjectEditMode(drill.containerId);
        st.select(drill.selectId);
        return;
      }

      let editTextId: string | null = node.type === "text" ? nodeId : null;
      if (!editTextId) {
        editTextId = pickDeepestNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, {
          types: ["text"],
        });
      }
      if (editTextId) {
        enterTextEditModeAtWorldPoint(editTextId, w.x, w.y);
        return;
      }

      if (shouldEnterPathEditOnEdit(node) && st.tool === "move") {
        if (st.pathEditModeNodeId === nodeId) st.setPathEditMode(null);
        else st.setPathEditMode(nodeId);
        return;
      }
      if (canEnterParametricShapeEdit(node) && st.tool === "move") {
        if (st.shapeEditModeNodeId === nodeId) st.exitShapeEditMode();
        else st.enterShapeEditMode(nodeId);
      }
    },
    [clientToWorld],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (e.button === 0 || e.button === 2) {
        if (!useEditorStore.getState().editingTextId) {
          activateCanvasForShortcuts();
        }
      }

      const st = useEditorStore.getState();
      const node = st.nodes[nodeId];
      if (!node?.visible) return;

      if (!canCanvasObjectInteract({ spaceDown, canvasPanning })) return;

      const deepSelect = isDeepSelectClick(e);
      const targetId = selectionTargetForClick(
        nodeId,
        st.nodes,
        st.childOrder,
        st.objectEditModeNodeId,
        deepSelect,
      );
      const { select, editorMode, tool } = st;

      if (editorMode === "inspect") {
        e.stopPropagation();
        if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;
        select(targetId, isAdditiveSelectionClick(e));
        return;
      }

      if (node.locked) {
        e.stopPropagation();
        if (isCanvasSelectTool()) select(targetId, isAdditiveSelectionClick(e));
        return;
      }

      e.stopPropagation();

      if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;

      if (tool !== "move" && tool !== "frame") {
        select(targetId, isAdditiveSelectionClick(e));
        return;
      }

      const additive = isAdditiveSelectionClick(e);
      applyMoveToolPointerSelection(targetId, st.selectedIds, additive, select);

      if (additive) return;

      if (e.button !== 0) return;
      if (!canCanvasObjectDrag()) return;

      if (e.altKey && !prepareAltDragDuplicate(targetId)) return;

      beginCanvasNodeDrag({
        nodeId: targetId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget as Element,
        fromAltDragDuplicate: e.altKey,
      });
    },
    [clientToWorld, spaceDown, canvasPanning, commandDown],
  );

  return {
    onEnter,
    onLeave,
    onContextMenu,
    onDoubleClick,
    onPointerDown,
    commandDown,
  };
}
