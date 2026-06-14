/** Suppresses stray pointer/click events after drag-to-create (avoids selecting the frame below). */
let suppressUntil = 0;

const SUPPRESS_MS = 150;

export function suppressPostCreationPointer(): void {
  suppressUntil = performance.now() + SUPPRESS_MS;
}

export function shouldSuppressCanvasPointer(): boolean {
  return performance.now() < suppressUntil;
}

export function clearPostCreationPointerSuppress(): void {
  suppressUntil = 0;
}

/** True while drag-to-create should ignore stray clicks (selection stealing). */
export function isPostCreationPointerSuppressed(): boolean {
  return shouldSuppressCanvasPointer();
}
