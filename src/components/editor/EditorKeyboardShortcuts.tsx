"use client";

import { useEffect } from "react";
import { useEditorStore, type Tool } from "@/stores/useEditorStore";
import { zoomCanvasAtViewportCenter } from "@/lib/viewportZoom";
import { KEYBOARD_ZOOM_STEP } from "@/lib/canvasZoom";
import { cancelActiveMarqueeFromKeyboard } from "@/lib/canvasMarqueeController";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { isEditableFieldElement } from "@/lib/editorKeyboardFocus";

function shouldIgnoreShortcutForTyping(target: EventTarget | null): boolean {
  const st = useEditorStore.getState();
  if (st.editingTextId) return true;
  if (st.layerRenameId) return true;
  return isEditableFieldElement(target);
}

export function EditorKeyboardShortcuts() {
  useEffect(() => {
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

      const stUi = useEditorStore.getState();
      if (e.key === "Escape") {
        if (cancelActiveMarqueeFromKeyboard()) {
          e.preventDefault();
          return;
        }
        if (stUi.closeTopmostOverlay()) {
          e.preventDefault();
          return;
        }
      }
      if (stUi.shortcutOverlayOpen) {
        return;
      }
      if (stUi.commandMenuOpen) {
        return;
      }
      if (stUi.aiModalOpen) {
        return;
      }
      if (stUi.pluginMarketplaceOpen || stUi.activePluginId) {
        return;
      }
      if (stUi.shareModalOpen || stUi.workspacePickerOpen || stUi.teamInviteModalOpen) {
        return;
      }

      if (e.key === "Escape") {
        const stEsc = useEditorStore.getState();
        if (stEsc.objectEditModeNodeId) {
          e.preventDefault();
          stEsc.exitObjectEditMode();
          return;
        }
        if (stEsc.penDrawingNodeId) {
          e.preventDefault();
          stEsc.cancelPath();
          return;
        }
        if (stEsc.pathEditModeNodeId) {
          e.preventDefault();
          stEsc.setPathEditMode(null);
          return;
        }
        if (stEsc.editorMode === "design" && stEsc.isPlacingComment) {
          e.preventDefault();
          stEsc.cancelPlacingComment();
          return;
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
        }
      }

      if (shouldIgnoreShortcutForTyping(e.target)) return;

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

      if (e.code === "Backspace" || e.code === "Delete") {
        const st = useEditorStore.getState();
        if (
          e.code === "Backspace" &&
          st.pathEditModeNodeId &&
          st.selectedPathPointId &&
          st.selectedIds.includes(st.pathEditModeNodeId)
        ) {
          e.preventDefault();
          st.deletePathPoint(st.pathEditModeNodeId, st.selectedPathPointId);
          return;
        }
        const deletable = topLevelSelectedIds(st.selectedIds, st.nodes).filter((id) => {
          const n = st.nodes[id];
          return n && !n.locked && n.visible;
        });
        if (deletable.length === 0) return;
        e.preventDefault();
        st.deleteSelection();
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

      if (e.key === "Escape") {
        e.preventDefault();
        const st = useEditorStore.getState();
        if (st.prototypePreview) {
          st.closePrototypePreview();
          return;
        }
        if (st.prototypeWireDrag) {
          st.cancelPrototypeConnection();
          return;
        }
        if (st.editingTextId) {
          st.setEditingTextId(null);
          return;
        }
        st.clearSelection();
        return;
      }

      if (mod || e.altKey) return;

      if (e.shiftKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        useEditorStore.getState().setTool("arrow");
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        useEditorStore.getState().setTool("line");
        return;
      }

      const map: Record<string, Tool> = {
        v: "move",
        V: "move",
        f: "frame",
        F: "frame",
        r: "rect",
        R: "rect",
        o: "ellipse",
        O: "ellipse",
        t: "text",
        T: "text",
        p: "pen",
        P: "pen",
        h: "hand",
        H: "hand",
      };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        const st = useEditorStore.getState();
        if (next === "pen" && st.editorMode !== "design") return;
        useEditorStore.getState().setTool(next);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
