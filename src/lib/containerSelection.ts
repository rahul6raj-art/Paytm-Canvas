import { isAncestorOf } from "@/lib/editorGraph";
import { isAutoLayoutContainerNode } from "@/lib/autoLayoutArrowReorder";
import type { EditorNode } from "@/stores/useEditorStore";

export function hasVisibleChildren(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  return (childOrder[nodeId] ?? []).some((cid) => nodes[cid]?.visible);
}

export function isEditableContainer(
  node: EditorNode,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  if (node.locked || !node.visible) return false;
  if (!hasVisibleChildren(nodeId, nodes, childOrder)) return false;
  if (node.isBooleanGroup && !node.maskId) return true;
  return node.type === "group" || node.type === "frame";
}

/** When true, child layers must not receive pointer hits — the container moves as one unit. */
export function shouldCollapseContainerHits(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  objectEditModeNodeId: string | null,
): boolean {
  const node = nodes[nodeId];
  if (!node?.visible) return false;
  if (!hasVisibleChildren(nodeId, nodes, childOrder)) return false;
  if (objectEditModeNodeId === nodeId) return false;
  if (objectEditModeNodeId && isAncestorOf(nodes, nodeId, objectEditModeNodeId)) {
    return false;
  }
  if (isAutoLayoutContainerNode(node)) return false;
  if (node.isBooleanGroup && !node.maskId) return true;
  return node.type === "group" || node.type === "frame";
}

/** Map a hit on a child to its parent group/frame for click + drag (unless drilling in). */
export function selectionTargetForClick(
  hitId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  objectEditModeNodeId: string | null,
): string {
  if (!hitId) return hitId;
  if (objectEditModeNodeId) {
    if (hitId === objectEditModeNodeId) return hitId;
    if (isAncestorOf(nodes, objectEditModeNodeId, hitId)) return hitId;
  }
  const n = nodes[hitId];
  const parentId = n?.parentId;
  if (!parentId) return hitId;
  const parent = nodes[parentId];
  if (!parent?.visible || parent.locked) return hitId;
  if (!hasVisibleChildren(parentId, nodes, childOrder)) return hitId;
  if (parent.type === "group" || parent.type === "frame") {
    if (isAutoLayoutContainerNode(parent)) return hitId;
    return parentId;
  }
  return hitId;
}

export type ContainerDrillTarget = { containerId: string; selectId: string };

/** Double-click: enter the container and select the deepest layer under the cursor. */
export function drillTargetForDoubleClick(
  hitId: string,
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  objectEditModeNodeId: string | null,
  pickDeepestAt: (x: number, y: number) => string | null,
): ContainerDrillTarget | null {
  const deepest = pickDeepestAt(worldX, worldY) ?? hitId;
  if (!deepest) return null;

  if (objectEditModeNodeId && isAncestorOf(nodes, objectEditModeNodeId, deepest)) {
    return { containerId: objectEditModeNodeId, selectId: deepest };
  }

  const containerId = selectionTargetForClick(deepest, nodes, childOrder, null);
  if (containerId !== deepest) {
    return { containerId, selectId: deepest };
  }

  const cn = nodes[deepest];
  if (cn && isEditableContainer(cn, deepest, nodes, childOrder)) {
    return { containerId: deepest, selectId: deepest };
  }

  return null;
}

/** Shift/Cmd/Ctrl+click adds to selection — must not start a drag on pointer down. */
export function isAdditiveSelectionClick(e: {
  shiftKey: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  return e.shiftKey || Boolean(e.metaKey) || Boolean(e.ctrlKey);
}

/** Preserve multi-selection when dragging an already-selected layer (Figma-style). */
export function applyMoveToolPointerSelection(
  targetId: string,
  selectedIds: string[],
  additive: boolean,
  select: (id: string | null, additive?: boolean) => void,
): void {
  if (additive) {
    select(targetId, true);
    return;
  }
  if (!selectedIds.includes(targetId)) {
    select(targetId, false);
  }
}
