/** Cross-surface visibility bridge (inspector gradient dialog → canvas handles). */

let openNodeId: string | null = null;
const listeners = new Set<() => void>();

export function setGradientEditorVisible(nodeId: string | null): void {
  if (openNodeId === nodeId) return;
  openNodeId = nodeId;
  listeners.forEach((l) => l());
}

export function subscribeGradientEditorVisible(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGradientEditorVisibleNodeId(): string | null {
  return openNodeId;
}
