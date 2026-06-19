/**
 * Exclusive access to the CraftEngine WASM instance.
 *
 * wasm-bindgen rejects overlapping borrows ("recursive use of an object…"). That
 * happens when ResizeObserver, async asset uploads, or store history checks call
 * into WASM while resize/render/sync still hold `&mut self`.
 */
let accessDepth = 0;
const pendingAccess: Array<() => void> = [];

export function runCraftEngineAccess(fn: () => void): void {
  if (accessDepth > 0) {
    pendingAccess.push(fn);
    return;
  }

  accessDepth += 1;
  try {
    fn();
  } finally {
    accessDepth -= 1;
    if (accessDepth === 0 && pendingAccess.length > 0) {
      const batch = pendingAccess.splice(0);
      for (const next of batch) {
        runCraftEngineAccess(next);
      }
    }
  }
}

/** @deprecated Use {@link runCraftEngineAccess}. */
export const runCraftEngineMutation = runCraftEngineAccess;

export function isCraftEngineAccessActive(): boolean {
  return accessDepth > 0;
}

/** @deprecated Use {@link isCraftEngineAccessActive}. */
export const isCraftEngineMutationActive = isCraftEngineAccessActive;

/** Read-only WASM call — returns fallback while exclusive access is active. */
export function readCraftEngine<T>(fn: () => T, fallback: T): T {
  if (accessDepth > 0) return fallback;
  try {
    return fn();
  } catch {
    return fallback;
  }
}

let deferredHistoryRefresh = false;

/** Refresh undo/redo flags from WASM, deferring if the engine is busy. */
export function deferRefreshWasmHistoryFlags(refresh: () => void): void {
  if (!isCraftEngineAccessActive()) {
    refresh();
    return;
  }
  if (deferredHistoryRefresh) return;
  deferredHistoryRefresh = true;
  queueMicrotask(() => {
    deferredHistoryRefresh = false;
    if (!isCraftEngineAccessActive()) refresh();
    else deferRefreshWasmHistoryFlags(refresh);
  });
}
