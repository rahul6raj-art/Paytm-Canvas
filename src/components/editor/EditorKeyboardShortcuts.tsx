"use client";

import { useEffect } from "react";
import { findInstanceRoot } from "@/lib/componentModel";
import { useEditorStore, type AlignDirection, type EditorState } from "@/stores/useEditorStore";
import {
  cycleCanvasFrame,
  resetCanvasView,
  zoomCanvasAtViewportCenter,
  zoomCanvasToFit,
  zoomCanvasToSelection,
} from "@/lib/viewportZoom";
import { KEYBOARD_ZOOM_STEP } from "@/lib/canvasZoom";
import { cancelActiveMarqueeFromKeyboard } from "@/lib/canvasMarqueeController";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { nodeSupportsStrokeWidth } from "@/lib/strokeAdjust";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import {
  activateCanvasForShortcuts,
  escapeToMovePointer,
  isShortcutOverlayOpen,
  resolveKeyboardFieldTarget,
  shouldAllowNativeFieldClipboard,
  shouldBlockDeleteSelectionShortcut,
  shouldYieldShortcutsToTyping,
  resolveToolFromKeyboardEvent,
} from "@/lib/editorKeyboardFocus";
import { pasteCanvasImageFromClipboard } from "@/lib/canvasImagePlace";
import { isVectorEditableShape } from "@/lib/shapes/shapeToPath";
import { clientToWorld } from "@/lib/canvasCoordinates";
import { tryDeleteActiveGradientStop } from "@/lib/gradientStopKeyboard";
function canUngroupSelection(st: EditorState): boolean {
  if (st.editorMode !== "design" || st.selectedIds.length !== 1) return false;
  const g = st.nodes[st.selectedIds[0]!];
  if (!g || g.type !== "group" || g.locked || !g.visible) return false;
  return ((st.childOrder[g.id] ?? []).length ?? 0) > 0;
}

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
      if (mod && e.shiftKey && e.code === "Slash") {
        e.preventDefault();
        const st = useEditorStore.getState();
        st.setShortcutOverlayOpen(!st.shortcutOverlayOpen);
        return;
      }
      if (mod && !e.shiftKey && e.code === "Slash") {
        e.preventDefault();
        const st = useEditorStore.getState();
        st.setCommandMenuOpen(!st.commandMenuOpen);
        return;
      }
      if (mod && (e.code === "Backslash" || e.code === "Period")) {
        e.preventDefault();
        useEditorStore.getState().toggleUiChrome();
        return;
      }
      if (!mod && e.shiftKey && e.code === "Backslash") {
        e.preventDefault();
        useEditorStore.getState().toggleUiChrome();
        return;
      }

      if (e.key === "Escape") {
        if (cancelActiveMarqueeFromKeyboard()) {
          e.preventDefault();
          escapeToMovePointer();
          return;
        }

        const st0 = useEditorStore.getState();
        if (st0.closeTopmostOverlay()) {
          e.preventDefault();
          return;
        }

        if (isShortcutOverlayOpen(useEditorStore.getState())) {
          return;
        }

        const st = useEditorStore.getState();
        e.preventDefault();

        if (st.penDrawingNodeId) {
          const drawNode = st.nodes[st.penDrawingNodeId];
          const pointCount =
            drawNode?.type === "path" ? (drawNode.pathPoints?.length ?? 0) : 0;
          if (pointCount >= 2) {
            st.finishPath(false);
          } else {
            st.cancelPath();
          }
          escapeToMovePointer();
          return;
        }
        if (st.editorMode === "design" && st.tool === "pen") {
          escapeToMovePointer();
          return;
        }
        if (st.pencilDrawingNodeId) {
          st.cancelPencilStroke();
          escapeToMovePointer();
          return;
        }
        if (st.editingTextId) {
          st.setEditingTextId(null);
          escapeToMovePointer();
          return;
        }
        if (st.shapeEditModeNodeId) {
          st.exitShapeEditMode();
          escapeToMovePointer();
          return;
        }
        if (st.pathEditModeNodeId) {
          if (st.selectedPathPointIds.length > 0) {
            st.setSelectedPathPointIds([]);
          } else {
            st.setPathEditMode(null);
          }
          escapeToMovePointer();
          return;
        }
        if (st.objectEditModeNodeId) {
          st.exitObjectEditMode();
          escapeToMovePointer();
          return;
        }

        const hasSelection =
          st.selectedIds.length > 0 ||
          st.selectedLayoutGuideId != null ||
          st.selectedPrototypeLinkId != null;
        const inTextOrStroke =
          Boolean(st.penDrawingNodeId) ||
          Boolean(st.pencilDrawingNodeId) ||
          Boolean(st.layerRenameId);

        if (hasSelection && !inTextOrStroke) {
          e.stopPropagation();
          st.clearSelection();
          escapeToMovePointer();
          return;
        }
        if (st.editorMode === "design" && st.isPlacingComment) {
          st.cancelPlacingComment();
          escapeToMovePointer();
          return;
        }
        if (st.prototypePreview) {
          st.closePrototypePreview();
          escapeToMovePointer();
          return;
        }
        if (st.prototypeWireDrag) {
          st.cancelPrototypeConnection();
          escapeToMovePointer();
          return;
        }
        st.clearSelection();
        escapeToMovePointer();
        return;
      }

      const stUi = useEditorStore.getState();
      if (isShortcutOverlayOpen(stUi)) {
        return;
      }

      if (!mod && !e.altKey) {
        const nextTool = resolveToolFromKeyboardEvent(e);
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
              if (nextTool === "comment") {
                stTool.setEditorMode("design");
                stTool.setTool("comment");
                stTool.startPlacingComment();
              } else {
                stTool.setTool(nextTool);
              }
              return;
            }
          }
        }
      }

      if (e.key === "Enter" && !e.shiftKey && !mod) {
        if (shouldYieldShortcutsToTyping(e, e.target)) return;
        const st = useEditorStore.getState();
        if (st.editingTextId) return;
        if (st.editorMode === "design" && st.tool === "pen" && st.penDrawingNodeId) {
          e.preventDefault();
          st.finishPath(false);
          return;
        }
        if (st.editorMode === "design" && st.selectedIds.length === 1) {
          const id = st.selectedIds[0]!;
          const n = st.nodes[id];
          if (
            !st.editingTextId &&
            n &&
            !n.locked &&
            n.visible !== false &&
            isVectorEditableShape(n)
          ) {
            e.preventDefault();
            if (st.pathEditModeNodeId === id) {
              st.exitAllEditModes();
            } else {
              st.enterVectorEditMode(id);
            }
            return;
          }
          if (e.metaKey || e.ctrlKey) {
            if (
              n &&
              !n.locked &&
              n.visible !== false &&
              isVectorEditableShape(n)
            ) {
              e.preventDefault();
              st.enterVectorEditMode(id);
              return;
            }
          }
          if (!st.editingTextId && n?.type === "text" && n.visible && !n.locked) {
            e.preventDefault();
            st.pushHistory();
            st.setEditingTextId(id);
            return;
          }
          if (n && !n.locked && n.visible !== false) {
            e.preventDefault();
            st.toggleEditMode(id);
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
            stDel.selectedPathPointIds.length > 0 &&
            stDel.selectedIds.includes(stDel.pathEditModeNodeId)
          ) {
            e.preventDefault();
            activateCanvasForShortcuts();
            stDel.deletePathPoints(stDel.pathEditModeNodeId, stDel.selectedPathPointIds);
            return;
          }
          if (stDel.selectedLayoutGuideId && stDel.editorMode === "design") {
            e.preventDefault();
            activateCanvasForShortcuts();
            stDel.removeLayoutGuide(stDel.selectedLayoutGuideId);
            return;
          }
          if (tryDeleteActiveGradientStop(e, e.target)) {
            activateCanvasForShortcuts();
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

      if (mod && !resolveKeyboardFieldTarget(e.target)) {
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
      if (mod && (e.code === "Digit0" || e.code === "Numpad0")) {
        e.preventDefault();
        activateCanvasForShortcuts();
        resetCanvasView();
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
      if (
        !mod &&
        !e.altKey &&
        e.shiftKey &&
        (e.code === "Digit2" || e.code === "Numpad2")
      ) {
        e.preventDefault();
        activateCanvasForShortcuts();
        zoomCanvasToSelection({ recordHistory: true });
        return;
      }
      if (!mod && !e.altKey && e.code === "KeyN") {
        e.preventDefault();
        activateCanvasForShortcuts();
        cycleCanvasFrame(e.shiftKey ? -1 : 1);
        return;
      }
      if (!mod && e.shiftKey && !e.altKey && e.code === "KeyR") {
        e.preventDefault();
        useEditorStore.getState().toggleRulers();
        return;
      }
      if (!mod && e.shiftKey && !e.altKey && e.code === "KeyI") {
        e.preventDefault();
        const st = useEditorStore.getState();
        if (st.editorMode === "design") {
          st.setLeftTab("assets");
        }
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
      if (mod && e.altKey && e.code === "KeyO") {
        e.preventDefault();
        useEditorStore.getState().outlineStrokeSelection();
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
        if (shouldAllowNativeFieldClipboard(e, e.target)) return;
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          const st = useEditorStore.getState();
          const viewport = document.querySelector<HTMLElement>("[data-canvas-viewport]");
          const toWorld = (clientX: number, clientY: number) =>
            clientToWorld(clientX, clientY, viewport, { pan: st.pan, zoom: st.zoom });
          void (async () => {
            const imagePasted = await pasteCanvasImageFromClipboard(
              null,
              toWorld,
              viewport,
              st.pan,
              st.zoom,
            );
            if (!imagePasted) st.pasteSelection();
          })();
        }
        return;
      }

      if (mod && e.code === "KeyD") {
        e.preventDefault();
        useEditorStore.getState().duplicateSelection();
        return;
      }

      const stDesign = useEditorStore.getState();
      if (stDesign.editorMode === "design" && !mod && !e.altKey && !resolveKeyboardFieldTarget(e.target)) {
        const bracketForward = e.code === "BracketRight" || e.key === "]";
        const bracketBack = e.code === "BracketLeft" || e.key === "[";
        if (bracketForward || bracketBack) {
          const strokeTargets = topLevelSelectedIds(stDesign.selectedIds, stDesign.nodes).filter(
            (id) => {
              const n = stDesign.nodes[id];
              return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
            },
          );
          const canNudgeStroke = strokeTargets.length > 0 || stDesign.tool === "pencil";
          if (
            canNudgeStroke &&
            !stDesign.editingTextId &&
            !stDesign.pathEditModeNodeId &&
            !stDesign.pencilDrawingNodeId
          ) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            stDesign.nudgeSelectionStrokeWidth(bracketForward ? step : -step);
            return;
          }
        }
      }

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

      const pathEditBlocksArrowNudge =
        Boolean(stDesign.pathEditModeNodeId) &&
        stDesign.selectedPathPointIds.length > 0;

      if (
        stDesign.editorMode === "design" &&
        !mod &&
        !e.altKey &&
        !stDesign.editingTextId &&
        !pathEditBlocksArrowNudge &&
        !resolveKeyboardFieldTarget(e.target)
      ) {
        const arrow =
          e.code === "ArrowUp" ||
          e.code === "ArrowDown" ||
          e.code === "ArrowLeft" ||
          e.code === "ArrowRight";
        if (arrow) {
          activateCanvasForShortcuts();
          const tops = topLevelSelectedIds(stDesign.selectedIds, stDesign.nodes).filter((id) => {
            const n = stDesign.nodes[id];
            return n && !n.locked && n.visible;
          });
          if (stDesign.reorderAutoLayoutChildByArrow(e.code, e.shiftKey)) {
            e.preventDefault();
            return;
          }
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
      if (mod && e.altKey && e.code === "KeyB") {
        e.preventDefault();
        const st = useEditorStore.getState();
        if (st.editorMode !== "design") return;
        const id = st.selectedIds[0];
        if (!id) return;
        const root = findInstanceRoot(st.nodes, id);
        if (root) st.detachInstance(root);
        return;
      }
      if (mod && e.altKey && e.code === "KeyG") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          useEditorStore.getState().wrapSelectionInFrame();
        }
        return;
      }

      if (!mod && e.altKey && !e.shiftKey) {
        const alignByCode: Record<string, AlignDirection> = {
          KeyA: "left",
          KeyD: "right",
          KeyW: "top",
          KeyS: "bottom",
          KeyH: "center-h",
          KeyV: "center-v",
        };
        const align = alignByCode[e.code];
        if (align && useEditorStore.getState().editorMode === "design") {
          e.preventDefault();
          useEditorStore.getState().alignSelection(align);
          return;
        }
      }

      if (mod && e.shiftKey && e.code === "KeyE") {
        e.preventDefault();
        useEditorStore.getState().openCodeRoundTrip("export");
        return;
      }
      if (mod && e.shiftKey && e.code === "KeyK") {
        e.preventDefault();
        if (useEditorStore.getState().editorMode === "design") {
          document.querySelector<HTMLInputElement>("[data-place-image-input]")?.click();
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
        const st = useEditorStore.getState();
        if (e.shiftKey) {
          if (canUngroupSelection(st)) st.ungroupSelection();
          else st.toggleGrid();
        } else {
          st.groupSelection();
        }
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

    const onWindowFocus = () => {
      const st = useEditorStore.getState();
      if (!isShortcutOverlayOpen(st)) {
        activateCanvasForShortcuts();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        onWindowFocus();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      const tgt = e.target;
      if (tgt instanceof Element && tgt.closest("[data-canvas-viewport], [data-svg-hit]")) {
        activateCanvasForShortcuts();
      }
    };

    const unsubStore = useEditorStore.subscribe((state, prev) => {
      if (state.selectedIds === prev.selectedIds) return;
      if (isShortcutOverlayOpen(state)) return;
      requestAnimationFrame(() => activateCanvasForShortcuts());
    });

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(focusTimer);
      unsubStore();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
