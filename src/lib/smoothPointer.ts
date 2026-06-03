/**
 * Figma-style high-frequency pointer handling: coalesced events + RAF-batched commits.
 */

const scheduleFrame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0);

/** All pointer samples since the last frame (misses nothing on fast moves). */
export function coalescedPointerEvents(ev: PointerEvent): PointerEvent[] {
  const coalesced = ev.getCoalescedEvents?.();
  return coalesced && coalesced.length > 0 ? coalesced : [ev];
}

export type RafPointerScheduler<T> = {
  schedule: (payload: T) => void;
  flush: () => void;
  cancel: () => void;
};

/** At most one `flushFn` per animation frame; keeps the latest payload. */
export function createRafPointerScheduler<T>(flushFn: (payload: T) => void): RafPointerScheduler<T> {
  let pending: T | null = null;
  let rafId = 0;

  const flush = () => {
    if (rafId) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
      } else {
        clearTimeout(rafId);
      }
      rafId = 0;
    }
    if (pending === null) return;
    const p = pending;
    pending = null;
    flushFn(p);
  };

  return {
    schedule(payload: T) {
      pending = payload;
      if (rafId) return;
      rafId = scheduleFrame(() => {
        rafId = 0;
        flush();
      }) as number;
    },
    flush,
    cancel() {
      if (rafId) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(rafId);
        } else {
          clearTimeout(rafId);
        }
      }
      rafId = 0;
      pending = null;
    },
  };
}

/** Invoke `handler` for every coalesced sample in a pointermove event. */
export function forEachCoalescedPointerEvent(
  ev: PointerEvent,
  handler: (pe: PointerEvent) => void,
): void {
  for (const pe of coalescedPointerEvents(ev)) {
    handler(pe);
  }
}
