/** Cross-surface focus bridge (canvas handles → inspector gradient dialog). */

export type GradientEditorFocusRequest = {
  nodeId: string;
  stopId: string;
  openColorPicker?: boolean;
  nonce: number;
};

let snapshot: GradientEditorFocusRequest | null = null;
const listeners = new Set<() => void>();

export function requestGradientEditorFocus(
  nodeId: string,
  stopId: string,
  opts?: { openColorPicker?: boolean },
): void {
  snapshot = {
    nodeId,
    stopId,
    openColorPicker: opts?.openColorPicker ?? true,
    nonce: (snapshot?.nonce ?? 0) + 1,
  };
  listeners.forEach((l) => l());
}

export function subscribeGradientEditorFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGradientEditorFocusSnapshot(): GradientEditorFocusRequest | null {
  return snapshot;
}

export function clearGradientEditorFocusIfConsumed(nonce: number): void {
  if (snapshot?.nonce === nonce) snapshot = null;
}
