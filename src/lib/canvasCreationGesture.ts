/**
 * After drag-to-create (shape/frame), the browser may synthesize a click on the layer
 * under the cursor before the new node is painted. That click can select a parent frame
 * instead of the shape we just created. Suppress the next canvas pointer/click burst.
 */

let suppressActive = false;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function clearCaptureListeners() {
  window.removeEventListener("pointerdown", onPointerDownCapture, true);
  window.removeEventListener("click", onClickCapture, true);
  if (cleanupTimer != null) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
}

function endSuppression() {
  suppressActive = false;
  clearCaptureListeners();
}

function onPointerDownCapture(ev: PointerEvent) {
  if (!suppressActive) return;
  endSuppression();
  ev.preventDefault();
  ev.stopPropagation();
}

function onClickCapture(ev: MouseEvent) {
  if (!suppressActive) return;
  endSuppression();
  ev.preventDefault();
  ev.stopPropagation();
}

/** Call when a drag-to-create gesture commits a new layer. */
export function suppressCanvasPointerAfterCreation(): void {
  endSuppression();
  suppressActive = true;
  window.addEventListener("pointerdown", onPointerDownCapture, true);
  window.addEventListener("click", onClickCapture, true);
  cleanupTimer = setTimeout(endSuppression, 400);
}

/** Returns true once if the next canvas object/bg pointer should be ignored. */
export function consumeCanvasPointerSuppression(): boolean {
  if (!suppressActive) return false;
  endSuppression();
  return true;
}
