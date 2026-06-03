import { cancelCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";

/** Lets keyboard handler cancel an active canvas marquee without tight Zustand coupling. */

let abort: (() => boolean) | null = null;

export function registerMarqueeAbortHandler(fn: (() => boolean) | null) {
  abort = fn;
}

export function cancelActiveMarqueeFromKeyboard(): boolean {
  if (cancelCanvasMarqueeSession()) return true;
  if (!abort) return false;
  return abort();
}
