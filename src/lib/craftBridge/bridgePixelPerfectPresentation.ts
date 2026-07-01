import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

function hideSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  id: string,
): void {
  const node = nodes[id];
  if (!node) return;
  nodes[id] = { ...node, visible: false };
  for (const kidId of childOrder[id] ?? []) {
    hideSubtree(nodes, childOrder, kidId);
  }
}

/**
 * Bridge push: keep the Playwright screenshot as a locked underlay for visual parity while
 * editable DOM layers stay on top for structure editing and round-trip.
 */
export function applyBridgeCaptureReferenceUnderlay(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const kids = childOrder[rootId] ?? [];
    let refId: string | null = null;

    for (const kidId of kids) {
      const kid = nodes[kidId];
      if (!kid?.isImportReference) continue;
      refId = kidId;
      nodes[kidId] = {
        ...kid,
        visible: true,
        locked: true,
        opacity: 1,
        x: 0,
        y: 0,
      };
    }

    if (!refId) continue;

    const root = nodes[rootId];
    if (root) {
      nodes[rootId] = {
        ...root,
        clipChildren: true,
      };
    }

    // Reference screenshot renders first (under editable layers).
    const withoutRef = kids.filter((id) => id !== refId);
    childOrder[rootId] = [refId, ...withoutRef];
  }
}

/**
 * Bridge push: show the Playwright screenshot as the visual truth; keep DOM layers
 * in the tree (hidden) for structure metadata and round-trip editing.
 */
export function applyBridgePixelPerfectPresentation(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const kids = childOrder[rootId] ?? [];
    let refId: string | null = null;

    for (const kidId of kids) {
      const kid = nodes[kidId];
      if (!kid?.isImportReference) continue;
      refId = kidId;
      nodes[kidId] = {
        ...kid,
        visible: true,
        locked: true,
        opacity: 1,
        x: 0,
        y: 0,
      };
    }

    for (const kidId of kids) {
      if (kidId === refId) continue;
      hideSubtree(nodes, childOrder, kidId);
    }

    const root = nodes[rootId];
    if (root && refId) {
      nodes[rootId] = {
        ...root,
        clipChildren: true,
        fillEnabled: false,
      };
    }
  }
}

export function sliceHasVisibleImportReference(
  nodes: Record<string, EditorNode>,
): boolean {
  return Object.values(nodes).some((n) => n.isImportReference && n.visible !== false);
}

export type BridgeLivePresentation = "pixel-perfect" | "editable-with-underlay";

/** Apply WYSIWYG presentation when a Playwright screenshot reference exists on the slice. */
export function applyBridgeLivePresentation(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  mode: BridgeLivePresentation = "pixel-perfect",
): boolean {
  const hasRef = Object.values(nodes).some((n) => n.isImportReference);
  if (!hasRef) return false;
  if (mode === "editable-with-underlay") {
    applyBridgeCaptureReferenceUnderlay(nodes, childOrder);
  } else {
    applyBridgePixelPerfectPresentation(nodes, childOrder);
  }
  return true;
}
