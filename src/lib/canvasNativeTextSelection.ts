/** Block browser text selection while dragging on the canvas (marquee, move, resize). */

export function clearBrowserTextSelection(): void {
  if (typeof window === "undefined") return;
  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    /* ignore */
  }
}

export function beginCanvasNativeTextSelectionSuppression(): () => void {
  if (typeof document === "undefined") return () => {};

  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";

  const onSelectStart = (e: Event) => {
    e.preventDefault();
    clearBrowserTextSelection();
  };

  document.addEventListener("selectstart", onSelectStart);
  clearBrowserTextSelection();

  return () => {
    document.removeEventListener("selectstart", onSelectStart);
    document.body.style.userSelect = prevUserSelect;
    clearBrowserTextSelection();
  };
}
