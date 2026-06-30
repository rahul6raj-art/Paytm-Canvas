/** Lets keyboard / blur handlers cancel an active rotate drag without tight coupling. */

type RotateDragAbort = () => boolean;

let abortRotateDrag: RotateDragAbort | null = null;

export function registerRotateDragAbortHandler(fn: RotateDragAbort | null): void {
  abortRotateDrag = fn;
}

export function cancelActiveRotateDragFromKeyboard(): boolean {
  if (!abortRotateDrag) return false;
  return abortRotateDrag();
}
