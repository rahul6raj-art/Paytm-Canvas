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

export function isToolShortcutEvent(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return toolFromShortcutKey(e.key) != null;
}

/**
 * Block canvas shortcuts while typing in fields — except tool keys, Delete, and modifier
 * shortcuts, which should work from the properties panel like Figma.
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
  if (isDeleteShortcutEvent(e) && !isMultilineEditableElement(target)) return false;
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
