/** Focus helpers so canvas tool shortcuts work after clicking the canvas. */

export function isEditableFieldElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
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
