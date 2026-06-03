import { cancelCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";

/** Lets keyboard handler cancel an active canvas marquee without tight Zustand coupling. */

let abort: (() => void) | null = null;

export function registerMarqueeAbortHandler(fn: (() => void) | null) {
  abort = fn;
}

export function cancelActiveMarqueeFromKeyboard(): boolean {
  if (cancelCanvasMarqueeSession()) return true;
  if (!abort) return false;
  abort();
  return true;
}
