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
  const el = target ?? (typeof document !== "undefined" ? document.activeElement : null);
  return isEditableFieldElement(el) && !isMultilineEditableElement(el);
}

/** Let inputs/textareas handle clipboard & undo/redo (code panel import, inspector fields). */
export function shouldAllowNativeFieldClipboard(
  e: KeyboardEvent,
  target: EventTarget | null,
): boolean {
  if (!isEditableFieldElement(target)) return false;
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
 * Block canvas shortcuts while typing in fields — except tool keys and modifier shortcuts.
 */
export function shouldYieldShortcutsToTyping(e: KeyboardEvent, target: EventTarget | null): boolean {
  const st = useEditorStore.getState();
  if (st.editingTextId || st.layerRenameId) {
    if (e.metaKey || e.ctrlKey) return false;
    if (e.key === "Escape") return false;
    return true;
  }
  if (!isEditableFieldElement(target)) return false;
  if (e.metaKey || e.ctrlKey) return false;
  if (e.key === "Escape") return false;
  if (isToolShortcutEvent(e)) return false;
  if (shouldBlockDeleteSelectionShortcut(e, target)) return true;
  return true;
}

/** Blur inspector/sidebar fields so canvas shortcuts (V, R, Delete, …) apply. */
export function releaseFieldFocusForCanvas(): void {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement && isEditableFieldElement(ae)) {
    ae.blur();
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

/** Blur property fields and move focus to the canvas for global shortcuts. */
export function activateCanvasForShortcuts(): void {
  releaseFieldFocusForCanvas();
  if (typeof document !== "undefined") {
    focusCanvasViewport(document.querySelector<HTMLElement>("[data-canvas-viewport]"));
  }
}
