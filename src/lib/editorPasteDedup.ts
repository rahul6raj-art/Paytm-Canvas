/** Suppress duplicate layer paste when Cmd+V runs both keydown and paste handlers. */
let lastKeyboardPasteAt = 0;

export function noteKeyboardEditorPaste(): void {
  lastKeyboardPasteAt = Date.now();
}

export function shouldSuppressDuplicateEditorPaste(): boolean {
  return Date.now() - lastKeyboardPasteAt < 500;
}
