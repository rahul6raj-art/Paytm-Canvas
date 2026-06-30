/** Focus helpers so canvas tool shortcuts work after clicking the canvas. */

import { useEditorStore, type EditorState, type Tool } from "@/stores/useEditorStore";
import { isRotateGeometryLockActive } from "@/lib/rotation/rotateGeometryLock";
import { resetCanvasRotateCursorState } from "@/lib/selectionRotateZones";

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

/** Space in inspector fields must not switch the canvas into hand/pan mode. */
export function shouldTrackSpaceForCanvasPan(e: Pick<KeyboardEvent, "code" | "target">): boolean {
  if (e.code !== "Space") return false;
  return !isEditableFieldElement(e.target);
}

/** Reconcile modifier keys from a pointer event (fixes stuck Space after field blur). */
export function syncCanvasPointerModifiers(
  e: Pick<PointerEvent, "getModifierState">,
  sync: {
    setSpaceDown: (v: boolean) => void;
    setOptionDown: (v: boolean) => void;
    setCommandDown: (v: boolean) => void;
  },
): void {
  sync.setSpaceDown(e.getModifierState("Space"));
  sync.setOptionDown(e.getModifierState("Alt"));
  sync.setCommandDown(e.getModifierState("Meta") || e.getModifierState("Control"));
}

/** Hidden textarea used for canvas inline text editing (must keep focus while typing). */
export function isCanvasTextEditFieldElement(el: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return false;
  return el.hasAttribute("data-text-editor") || Boolean(el.closest("[data-text-editor]"));
}

/** Floating canvas page name rename field — must keep focus while typing. */
export function isPageNameEditFieldElement(el: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return false;
  return (
    el.hasAttribute("data-page-name-editor") ||
    Boolean(el.closest("[data-page-name-editor]"))
  );
}

export function isPageNameEditActive(): boolean {
  if (typeof document === "undefined") return false;
  if (isPageNameEditFieldElement(document.activeElement)) return true;
  return Boolean(document.querySelector("[data-page-name-editor]"));
}

/** True when canvas tool shortcuts must not fire — user is typing in any field. */
export function shouldBlockToolShortcutsForTyping(target: EventTarget | null): boolean {
  if (isPageNameEditFieldElement(target) || isPageNameEditActive()) return true;
  const field = resolveKeyboardFieldTarget(target);
  if (!field) return false;
  if (isCanvasTextEditFieldElement(field)) return false;
  return isEditableFieldElement(field);
}

/** Left sidebar inputs/textareas — search, Mitra prompt, layer rename, etc. */
export function isLeftSidebarTypingFieldElement(el: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return false;
  if (!isEditableFieldElement(el)) return false;
  if (el.hasAttribute("data-sidebar-typing-field")) return true;
  return Boolean(el.closest("[data-left-sidebar]"));
}

function focusPageNameEditField(): void {
  if (typeof document === "undefined") return;
  const input = document.querySelector<HTMLInputElement>("[data-page-name-editor]");
  if (!input) return;
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

export function focusActiveTextEditField(nodeId?: string | null): void {
  if (typeof document === "undefined") return;
  const id = nodeId ?? useEditorStore.getState().editingTextId;
  if (!id) return;
  const el = document.querySelector<HTMLTextAreaElement>(`[data-text-editor="${id}"]`);
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
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
  const st = useEditorStore.getState();
  if (st.editingTextId || st.layerRenameId) return true;
  if (isPageNameEditFieldElement(resolveKeyboardFieldTarget(target)) || isPageNameEditActive()) {
    return true;
  }
  return Boolean(resolveKeyboardFieldTarget(target));
}

export function isUndoRedoShortcut(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false;
  return e.code === "KeyZ" || e.code === "KeyY";
}

/** Let inputs/textareas handle clipboard in fields (not undo/redo — those stay on the canvas stack). */
export function shouldAllowNativeFieldClipboard(
  e: KeyboardEvent,
  target: EventTarget | null,
): boolean {
  if (!resolveKeyboardFieldTarget(target)) return false;
  if (!(e.metaKey || e.ctrlKey)) return false;
  if (isUndoRedoShortcut(e)) return false;
  return (
    e.code === "KeyV" ||
    e.code === "KeyC" ||
    e.code === "KeyX" ||
    e.code === "KeyA"
  );
}

/**
 * Block canvas shortcuts while typing in fields (including single-line hex/number inputs).
 * Modifier shortcuts (undo, copy, etc.) still reach the canvas handler when appropriate.
 */
export function shouldYieldShortcutsToTyping(e: KeyboardEvent, target: EventTarget | null): boolean {
  // Canvas undo/redo must work even when an inspector field still has focus (Figma-style).
  if (isUndoRedoShortcut(e)) return false;

  const st = useEditorStore.getState();
  if (st.editingTextId || st.layerRenameId) {
    if (e.metaKey || e.ctrlKey) return false;
    if (e.key === "Escape") return false;
    return true;
  }
  if (shouldBlockToolShortcutsForTyping(target)) {
    if (e.metaKey || e.ctrlKey) return shouldAllowNativeFieldClipboard(e, target);
    if (e.key === "Escape") return false;
    return true;
  }
  const field = resolveKeyboardFieldTarget(target);
  if (shouldAllowNativeFieldClipboard(e, target)) return true;
  if (e.metaKey || e.ctrlKey) return false;
  if (e.key === "Escape") return false;
  if (shouldBlockDeleteSelectionShortcut(e, target)) return true;
  return false;
}

/** Blur inspector/sidebar fields so canvas shortcuts (V, R, Delete, …) apply. */
export function releaseFieldFocusForCanvas(): void {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement && isEditableFieldElement(ae)) {
    if (isCanvasTextEditFieldElement(ae)) return;
    if (isPageNameEditFieldElement(ae) || isPageNameEditActive()) return;
    if (isLeftSidebarTypingFieldElement(ae)) return;
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
  resetCanvasRotateCursorState();
}

/** Blur property fields and move focus to the canvas for global shortcuts. */
export function activateCanvasForShortcuts(): void {
  recoverCanvasInteractionState();
  const st = useEditorStore.getState();
  if (st.editingTextId) {
    focusActiveTextEditField(st.editingTextId);
    return;
  }
  if (isPageNameEditActive()) {
    focusPageNameEditField();
    return;
  }
  if (typeof document !== "undefined") {
    const ae = document.activeElement;
    if (isLeftSidebarTypingFieldElement(ae)) return;
  }
  releaseFieldFocusForCanvas();
  releaseChromeControlFocus();
  if (typeof document !== "undefined") {
    focusCanvasViewport(document.querySelector<HTMLElement>("[data-canvas-viewport]"));
  }
}

/** Figma-style Escape: return the canvas pointer to the move (V) tool. */
export function escapeToMovePointer(): void {
  const st = useEditorStore.getState();
  if (st.transformInteractionMode !== "none" || isRotateGeometryLockActive(st)) {
    useEditorStore.setState({
      transformInteractionMode: "none",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: null,
    });
  }
  if (st.tool !== "move") {
    st.setTool("move");
  }
  activateCanvasForShortcuts();
}
