import type { LayerBlendMode } from "@/lib/layerBlendMode";
import type { EditorNode } from "@/stores/useEditorStore";

export type BlendModePreview = {
  nodeIds: readonly string[];
  blendMode: LayerBlendMode;
};

let livePreview: BlendModePreview | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeBlendModePreview(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getBlendModePreview(): BlendModePreview | null {
  return livePreview;
}

export function setBlendModePreview(nodeIds: readonly string[], blendMode: LayerBlendMode): void {
  if (nodeIds.length === 0) return;
  livePreview = { nodeIds, blendMode };
  notify();
}

export function clearBlendModePreview(): void {
  if (!livePreview) return;
  livePreview = null;
  notify();
}

export function nodeBlendModeForPreview(
  nodeId: string,
  node: Pick<EditorNode, "type" | "blendMode">,
  preview: BlendModePreview | null = livePreview,
): Pick<EditorNode, "type" | "blendMode"> {
  if (preview && preview.nodeIds.includes(nodeId)) {
    return { ...node, blendMode: preview.blendMode };
  }
  return node;
}
