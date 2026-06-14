/** Focus helpers so canvas tool shortcuts work after clicking the canvas. */

import { useEditorStore, type EditorState, type Tool } from "@/stores/useEditorStore";

const TOOL_SHORTCUT_MAP: Record<string, Tool> = {
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

function elementTagName(el: EventTarget | null): string | null {
  if (!el || typeof el !== "object") return null;
  const tag = (el as { tagName?: string }).tagName;
  return typeof tag === "string" ? tag.toUpperCase() : null;
}

export function isEditableFieldElement(el: EventTarget | null): boolean {
  const tag = elementTagName(el);
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (typeof HTMLElement !== "undefined" && el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  return false;
}

/** Event target or focused field — keydown target can differ from activeElement in some trees. */
export function resolveKeyboardFieldTarget(target: EventTarget | null): EventTarget | null {
  if (isEditableFieldElement(target)) return target;
  if (typeof document !== "undefined" && isEditableFieldElement(document.activeElement)) {
    return document.activeElement;
  }
  return null;
}

export function isMultilineEditableElement(el: EventTarget | null): boolean {
  if (elementTagName(el) === "TEXTAREA") return true;
  if (typeof HTMLElement !== "undefined" && el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  return false;
}

export function isDeleteShortcutEvent(e: KeyboardEvent): boolean {
  return e.code === "Delete" || e.code === "Backspace";
}

/** True when a modal/overlay should consume keyboard shortcuts. */
export function isShortcutOverlayOpen(st: EditorState): boolean {
  return (
    st.shortcutOverlayOpen ||
    st.commandMenuOpen ||
    st.aiModalOpen ||
    st.pluginMarketplaceOpen ||
    Boolean(st.activePluginId) ||
    st.shareModalOpen ||
    st.workspacePickerOpen ||
    st.teamInviteModalOpen ||
    st.codeRoundTripOpen ||
    st.importHubOpen ||
    st.importWebModalOpen ||
    st.importFigmaModalOpen ||
    Boolean(st.prototypePreview)
  );
}

export function toolFromShortcutKey(key: string): Tool | null {
  return TOOL_SHORTCUT_MAP[key] ?? null;
}

/** Resolve canvas tool from a keydown (Figma-style, including ⇧L, ⇧P, ⇧S, C). */
export function resolveToolFromKeyboardEvent(e: KeyboardEvent): Tool | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const key = e.key;
  if (key === "l" || key === "L") return e.shiftKey ? "arrow" : "line";
  if (e.shiftKey && (key === "p" || key === "P")) return "pencil";
  if (e.shiftKey && (key === "s" || key === "S")) return "frame";
  if (!e.shiftKey && (key === "c" || key === "C")) return "comment";
  if (e.shiftKey) return null;
  return toolFromShortcutKey(key);
}

export function isToolShortcutEvent(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return resolveToolFromKeyboardEvent(e) != null;
}

/** True when Delete/Backspace should edit field text, not delete canvas selection. */
export function shouldBlockDeleteSelectionShortcut(
  e: KeyboardEvent,
  target: EventTarget | null,
): boolean {
  if (!isDeleteShortcutEvent(e)) return false;
  const el = resolveKeyboardFieldTarget(target);
  return Boolean(el) && !isMultilineEditableElement(el);
}

/** Let inputs/textareas handle clipboard & undo/redo (code panel import, inspector fields). */
export function shouldAllowNativeFieldClipboard(
  e: KeyboardEvent,
  target: EventTarget | null,
): boolean {
  if (!resolveKeyboardFieldTarget(target)) return false;
  if (!(e.metaKey || e.ctrlKey)) return false;
  return (
    e.code === "KeyV" ||
    e.code === "KeyC" ||
    e.code === "KeyX" ||
    e.code === "KeyA" ||
    e.code === "KeyZ" ||
    e.code === "KeyY"
  );
}

/**
 * Block canvas shortcuts while typing in fields (including single-line hex/number inputs).
 * Modifier shortcuts (undo, copy, etc.) still reach the canvas handler when appropriate.
 */
export function shouldYieldShortcutsToTyping(e: KeyboardEvent, target: EventTarget | null): boolean {
  const st = useEditorStore.getState();
  if (st.editingTextId || st.layerRenameId) {
    if (e.metaKey || e.ctrlKey) return false;
    if (e.key === "Escape") return false;
    return true;
  }
  // Figma-style: V/R/P/F… switch tools even when an inspector field still has DOM focus.
  if (isToolShortcutEvent(e)) return false;
  const field = resolveKeyboardFieldTarget(target);
  if (!field) return false;
  if (shouldAllowNativeFieldClipboard(e, target)) return true;
  if (e.metaKey || e.ctrlKey) return false;
  if (e.key === "Escape") return false;
  if (shouldBlockDeleteSelectionShortcut(e, target)) return true;
  // Allow canvas nudge/reorder when a single-line field is focused but empty.
  if (
    elementTagName(field) === "INPUT" &&
    !isMultilineEditableElement(field) &&
    (e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight")
  ) {
    const raw = (field as { value?: string }).value ?? "";
    if (raw.trim() === "") return false;
  }
  return true;
}

/** Blur inspector/sidebar fields so canvas shortcuts (V, R, Delete, …) apply. */
export function releaseFieldFocusForCanvas(): void {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement && isEditableFieldElement(ae)) {
    ae.blur();
  }
}

/** Blur focused chrome buttons/links that steal Space/Enter after toolbar or menu clicks. */
export function releaseChromeControlFocus(): void {
  if (typeof document === "undefined") return;
  const ae = document.activeElement;
  if (!(ae instanceof HTMLElement)) return;
  if (isEditableFieldElement(ae)) return;
  const tag = ae.tagName;
  if (tag !== "BUTTON" && tag !== "A") return;
  if (!ae.closest("[data-app-chrome]")) return;
  ae.blur();
}

/**
 * Dashboard-only import overlays share Zustand flags with the editor but are not
 * mounted in AppShell — clear them on editor entry so shortcuts are not blocked invisibly.
 */
export function resetStaleEditorOverlays(): void {
  const st = useEditorStore.getState();
  const patch: Partial<EditorState> = {};
  if (st.importHubOpen) patch.importHubOpen = false;
  if (st.importWebModalOpen) patch.importWebModalOpen = false;
  if (Object.keys(patch).length > 0) {
    useEditorStore.setState(patch);
  }
}

export function focusCanvasViewport(el: HTMLElement | null | undefined): void {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
}

/** Clear stuck drag/resize body styles that can block clicks and keyboard routing. */
export function recoverCanvasInteractionState(): void {
  if (typeof document === "undefined") return;
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
}

/** Blur property fields and move focus to the canvas for global shortcuts. */
export function activateCanvasForShortcuts(): void {
  recoverCanvasInteractionState();
  releaseFieldFocusForCanvas();
  releaseChromeControlFocus();
  if (typeof document !== "undefined") {
    focusCanvasViewport(document.querySelector<HTMLElement>("[data-canvas-viewport]"));
  }
}

/** Figma-style Escape: return the canvas pointer to the move (V) tool. */
export function escapeToMovePointer(): void {
  const st = useEditorStore.getState();
  if (st.transformInteractionMode !== "none" || st.rotateGeomSnapshot) {
    useEditorStore.setState({
      transformInteractionMode: "none",
      rotateGeomSnapshot: null,
    });
  }
  if (st.tool !== "move") {
    st.setTool("move");
  }
  activateCanvasForShortcuts();
}
