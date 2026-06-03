"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { zoomCanvasAtViewportCenter, zoomCanvasToFit } from "@/lib/viewportZoom";
import { KEYBOARD_ZOOM_STEP } from "@/lib/canvasZoom";
import { cancelActiveMarqueeFromKeyboard } from "@/lib/canvasMarqueeController";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import {
  activateCanvasForShortcuts,
  isMultilineEditableElement,
  isShortcutOverlayOpen,
  shouldBlockDeleteSelectionShortcut,
  shouldYieldShortcutsToTyping,
  toolFromShortcutKey,
} from "@/lib/editorKeyboardFocus";

export function EditorKeyboardShortcuts() {
  useEffect(() => {
    const focusTimer = window.setTimeout(() => activateCanvasForShortcuts(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.code === "KeyK") {
        e.preventDefault();
        const st = useEditorStore.getState();
        st.setCommandMenuOpen(!st.commandMenuOpen);
        return;
      }
      if (mod && e.code === "Slash") {
        e.preventDefault();
        const st = useEditorStore.getState();
        st.setShortcutOverlayOpen(!st.shortcutOverlayOpen);
        return;
      }
      if (mod && e.code === "Period") {
        e.preventDefault();
        useEditorStore.getState().toggleUiChrome();
        return;
      }

      if (e.key === "Escape") {
        if (cancelActiveMarqueeFromKeyboard()) {
          e.preventDefault();
          return;
        }

        const st0 = useEditorStore.getState();
        if (st0.closeTopmostOverlay()) {
          e.preventDefault();
        }

        if (isShortcutOverlayOpen(useEditorStore.getState())) {
          return;
        }

        const st = useEditorStore.getState();
        const hasSelection =
          st.selectedIds.length > 0 ||
          st.selectedLayoutGuideId != null ||
          st.selectedPrototypeLinkId != null;
        const inTextOrStroke =
          Boolean(st.editingTextId) ||
          Boolean(st.penDrawingNodeId) ||
          Boolean(st.pencilDrawingNodeId) ||
          Boolean(st.layerRenameId);

        if (hasSelection && !inTextOrStroke) {
          e.preventDefault();
          e.stopPropagation();
          activateCanvasForShortcuts();
          st.clearSelection();
          return;
        }

        if (st.penDrawingNodeId) {
          e.preventDefault();
          st.cancelPath();
          return;
        }
        if (st.pencilDrawingNodeId) {
          e.preventDefault();
          st.cancelPencilStroke();
          return;
        }
        if (st.objectEditModeNodeId) {
          e.preventDefault();
          st.exitObjectEditMode();
          return;
        }
        if (st.pathEditModeNodeId) {
          e.preventDefault();
          st.setPathEditMode(null);
          return;
        }
        if (st.editorMode === "design" && st.isPlacingComment) {
          e.preventDefault();
          st.cancelPlacingComment();
          return;
        }
        if (st.prototypePreview) {
          e.preventDefault();
          st.closePrototypePreview();
          return;
        }
        if (st.prototypeWireDrag) {
          e.preventDefault();
          st.cancelPrototypeConnection();
          return;
        }
        if (st.editingTextId) {
          e.preventDefault();
          st.setEditingTextId(null);
          return;
        }

        e.preventDefault();
        st.clearSelection();
        return;
      }

      const stUi = useEditorStore.getState();
      if (isShortcutOverlayOpen(stUi)) {
        return;
      }

      if (!mod && !e.altKey && !isMultilineEditableElement(e.target)) {
        const lineTool = e.key === "l" || e.key === "L";
        const nextTool = lineTool ? (e.shiftKey ? "arrow" : "line") : toolFromShortcutKey(e.key);
        if (nextTool) {
          const stTool = useEditorStore.getState();
          if (!stTool.editingTextId && !stTool.layerRenameId && !isShortcutOverlayOpen(stTool)) {
            const allowedInInspect = nextTool === "move" || nextTool === "hand";
            const modeOk =
              stTool.editorMode === "design" ||
              (stTool.editorMode === "inspect" && allowedInInspect);
            if (modeOk && (nextTool !== "pen" || stTool.editorMode === "design")) {
              e.preventDefault();
              e.stopPropagation();
              activateCanvasForShortcuts();
              stTool.setTool(nextTool);
              return;
            }
          }
        }
      }

      if (e.key === "Enter" && !e.shiftKey && !mod) {
        const st = useEditorStore.getState();
        if (st.editorMode === "design" && st.tool === "pen" && st.penDrawingNodeId) {
          e.preventDefault();
          st.finishPath(false);
          return;
        }
        if (st.editorMode === "design" && !st.editingTextId && st.selectedIds.length === 1) {
          const id = st.selectedIds[0]!;
          const n = st.nodes[id];
          if (n?.type === "text" && n.visible && !n.locked) {
            e.preventDefault();
            st.pushHistory();
            st.setEditingTextId(id);
            return;
          }
          if (
            n &&
            !n.locked &&
            n.visible !== false &&
            (n.type === "rectangle" ||
              n.type === "ellipse" ||
              n.type === "line" ||
              n.type === "path") &&
            !st.pathEditModeNodeId
          ) {
            e.preventDefault();
            st.enterVectorEditMode(id);
            return;
          }
        }
      }

      if (e.code === "Backspace" || e.code === "Delete") {
        const stDel = useEditorStore.getState();
        const blockDeleteSelection = shouldBlockDeleteSelectionShortcut(e, e.target);
        if (
          !blockDeleteSelection &&
          !isShortcutOverlayOpen(stDel) &&
          stDel.editorMode === "design"
        ) {
          if (
            e.code === "Backspace" &&
            stDel.pathEditModeNodeId &&
            stDel.selectedPathPointId &&
            stDel.selectedIds.includes(stDel.pathEditModeNodeId)
          ) {
            e.preventDefault();
            activateCanvasForShortcuts();
            stDel.deletePathPoint(stDel.pathEditModeNodeId, stDel.selectedPathPointId);
            return;
          }
          if (stDel.selectedLayoutGuideId && stDel.editorMode === "design") {
            e.preventDefault();
            activateCanvasForShortcuts();
            stDel.removeLayoutGuide(stDel.selectedLayoutGuideId);
            return;
          }
          const deletable = topLevelSelectedIds(stDel.selectedIds, stDel.nodes).filter((id) => {
            const n = stDel.nodes[id];
            return n && !n.locked && n.visible;
          });
          if (deletable.length > 0) {
            e.preventDefault();
            activateCanvasForShortcuts();
            stDel.deleteSelection();
            return;
          }
        }
      }

      if (shouldYieldShortcutsToTyping(e, e.target)) return;

      if (mod) {
        activateCanvasForShortcuts();
      }

      if (mod && (e.code === "Equal" || e.code === "NumpadAdd")) {
        e.preventDefault();
        zoomCanvasAtViewportCenter(KEYBOARD_ZOOM_STEP, { recordHistory: true });
        return;
      }
      if (mod && (e.code === "Minus" || e.code === "NumpadSubtract")) {
        e.preventDefault();
        zoomCanvasAtViewportCenter(1 / KEYBOARD_ZOOM_STEP, { recordHistory: true });
        return;
      }

      if (
        !mod &&
        !e.altKey &&
        e.shiftKey &&
        (e.code === "Digit1" || e.code === "Numpad1")
      ) {
        e.preventDefault();
        activateCanvasForShortcuts();
        zoomCanvasToFit({ recordHistory: true });
        return;
      }

      if (mod && e.altKey && e.code === "KeyU") {
        e.preventDefault();
        useEditorStore.getState().createBooleanGroup("union");
        return;
      }
      if (mod && e.altKey && e.code === "KeyS") {
        e.preventDefault();
        useEditorStore.getState().createBooleanGroup("subtract");
        return;
      }
      if (mod && e.altKey && e.code === "KeyI") {
        e.preventDefault();
        useEditorStore.getState().createBooleanGroup("intersect");
        return;
      }
      if (mod && e.altKey && e.code === "KeyE") {
        e.preventDefault();
        useEditorStore.getState().createBooleanGroup("exclude");
        return;
      }
      if (mod && e.altKey && e.code === "KeyF") {
        e.preventDefault();
        useEditorStore.getState().flattenSelection();
        return;
      }
      if (mod && e.altKey && e.code === "KeyM") {
        e.preventDefault();
        useEditorStore.getState().useSelectionAsMask();
        return;
      }

      if (mod && e.altKey && e.code === "ArrowUp") {
        e.preventDefault();
        useEditorStore.getState().cycleActivePage(-1);
        return;
      }
      if (mod && e.altKey && e.code === "ArrowDown") {
        e.preventDefault();
        useEditorStore.getState().cycleActivePage(1);
        return;
      }
      if (mod && e.shiftKey && e.code === "KeyN") {
        e.preventDefault();
        useEditorStore.getState().addPage();
        return;
      }

      if (mod && e.code === "KeyZ" && e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().redo();
        return;
      }
      if (mod && e.code === "KeyZ") {
        e.preventDefault();
        useEditorStore.getState().undo();
        return;
      }
      if (mod && e.code === "KeyY") {
        e.preventDefault();
        useEditorStore.getState().redo();
        return;
      }

      if (mod && e.code === "KeyA") {
        e.preventDefault();
        useEditorStore.getState().selectAllEditable();
        return;
      }
      if (mod && e.code === "KeyL") {
        e.preventDefault();
        useEditorStore.getState().toggleLockSelection();
        return;
      }
      if (mod && e.shiftKey && e.code === "KeyH") {
        e.preventDefault();
        useEditorStore.getState().toggleVisibleSelection();
        return;
      }
      if (mod && e.shiftKey && e.code === "KeyV") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          useEditorStore.getState().pasteSelection({ inPlace: true });
        }
        return;
      }
      if (mod && e.code === "KeyC") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          useEditorStore.getState().copySelection();
        }
        return;
      }
      if (mod && e.code === "KeyX") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          useEditorStore.getState().cutSelection();
        }
        return;
      }
      if (mod && e.code === "KeyV") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          useEditorStore.getState().pasteSelection();
        }
        return;
      }

      if (mod && e.code === "KeyD") {
        e.preventDefault();
        useEditorStore.getState().duplicateSelection();
        return;
      }

      const stDesign = useEditorStore.getState();
      if (stDesign.editorMode === "design" && mod) {
        const bracketForward = e.code === "BracketRight" || e.key === "]";
        const bracketBack = e.code === "BracketLeft" || e.key === "[";
        if (bracketForward) {
          e.preventDefault();
          if (e.shiftKey) stDesign.bringToFront();
          else stDesign.bringForward();
          return;
        }
        if (bracketBack) {
          e.preventDefault();
          if (e.shiftKey) stDesign.sendToBack();
          else stDesign.sendBackward();
          return;
        }
      }

      if (stDesign.editorMode === "design" && !stDesign.editingTextId && !stDesign.pathEditModeNodeId) {
        const arrow =
          e.code === "ArrowUp" ||
          e.code === "ArrowDown" ||
          e.code === "ArrowLeft" ||
          e.code === "ArrowRight";
        if (arrow) {
          const tops = topLevelSelectedIds(stDesign.selectedIds, stDesign.nodes).filter((id) => {
            const n = stDesign.nodes[id];
            return n && !n.locked && n.visible;
          });
          if (tops.length > 0) {
            e.preventDefault();
            const step = screenPxToWorld(e.shiftKey ? 10 : 1, stDesign.zoom);
            let dx = 0;
            let dy = 0;
            if (e.code === "ArrowLeft") dx = -step;
            if (e.code === "ArrowRight") dx = step;
            if (e.code === "ArrowUp") dy = -step;
            if (e.code === "ArrowDown") dy = step;
            stDesign.nudgeSelection(dx, dy);
            return;
          }
        }
      }

      if (mod && e.altKey && e.code === "KeyK") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          useEditorStore.getState().createComponentFromSelection();
        }
        return;
      }

      if (!mod && e.altKey && e.code === "Digit2") {
        e.preventDefault();
        const stComp = useEditorStore.getState();
        if (stComp.editorMode === "design") {
          stComp.setLeftTab("components");
        }
        return;
      }

      if (mod && e.code === "KeyG") {
        e.preventDefault();
        if (e.shiftKey) useEditorStore.getState().ungroupSelection();
        else useEditorStore.getState().groupSelection();
        return;
      }

      if (!mod && e.shiftKey && e.code === "KeyA") {
        const stAl = useEditorStore.getState();
        if (
          stAl.editorMode === "design" &&
          canAddAutoLayoutToSelection(stAl.selectedIds, stAl.nodes)
        ) {
          e.preventDefault();
          stAl.addAutoLayoutToSelection();
          return;
        }
      }

    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
