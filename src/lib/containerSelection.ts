import { isAncestorOf, layerPanelChildIds } from "@/lib/editorGraph";
import { isAutoLayoutContainerNode } from "@/lib/autoLayoutArrowReorder";
import type { EditorNode } from "@/stores/useEditorStore";

export function hasVisibleChildren(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  return layerPanelChildIds(nodeId, nodes, childOrder).some((cid) => nodes[cid]?.visible);
}

/** Empty frames are selectable by tapping anywhere; populated manual frames only via children.
 * Auto-layout frames receive body hits when children are collapsed for group-style drag. */
export function frameBodyReceivesPointerHits(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  deepSelect = false,
): boolean {
  const node = nodes[nodeId];
  if (node?.type !== "frame") return true;
  if (
    !deepSelect &&
    isAutoLayoutContainerNode(node) &&
    hasVisibleChildren(nodeId, nodes, childOrder)
  ) {
    return true;
  }
  return !hasVisibleChildren(nodeId, nodes, childOrder);
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

/** ⌘/Ctrl held — select nested layers inside frames and groups (Figma-style deep select). */
export function isDeepSelectClick(e: {
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  return Boolean(e.metaKey) || Boolean(e.ctrlKey);
}

/** When true, child layers must not receive pointer hits — the container moves as one unit. */
export function shouldCollapseContainerHits(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  objectEditModeNodeId: string | null,
  deepSelect = false,
): boolean {
  const node = nodes[nodeId];
  if (!node?.visible) return false;
  if (!hasVisibleChildren(nodeId, nodes, childOrder)) return false;
  if (objectEditModeNodeId === nodeId) return false;
  if (objectEditModeNodeId && isAncestorOf(nodes, nodeId, objectEditModeNodeId)) {
    return false;
  }
  if (deepSelect) return false;
  if (isAutoLayoutContainerNode(node)) return true;
  if (node.isBooleanGroup && !node.maskId) return true;
  if (node.type === "frame") return false;
  return node.type === "group";
}

/** Map a hit on a child to its parent group/frame for click + drag (unless drilling in). */
export function selectionTargetForClick(
  hitId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  objectEditModeNodeId: string | null,
  deepSelect = false,
): string {
  if (!hitId) return hitId;
  if (objectEditModeNodeId) {
    if (hitId === objectEditModeNodeId) return hitId;
    if (isAncestorOf(nodes, objectEditModeNodeId, hitId)) return hitId;
  }
  if (deepSelect) return hitId;
  const n = nodes[hitId];
  const parentId = n?.parentId;
  if (!parentId) return hitId;
  const parent = nodes[parentId];
  if (!parent?.visible || parent.locked) return hitId;
  if (!hasVisibleChildren(parentId, nodes, childOrder)) return hitId;
  if (parent.type === "group" || parent.type === "frame") {
    if (isAutoLayoutContainerNode(parent)) return parentId;
    if (parent.type === "frame") return hitId;
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

  const parentId = nodes[deepest]?.parentId;
  if (parentId) {
    const parent = nodes[parentId];
    if (
      parent?.visible &&
      !parent.locked &&
      parent.type === "frame" &&
      hasVisibleChildren(parentId, nodes, childOrder) &&
      isEditableContainer(parent, parentId, nodes, childOrder)
    ) {
      return { containerId: parentId, selectId: deepest };
    }
  }

  const cn = nodes[deepest];
  if (cn && isEditableContainer(cn, deepest, nodes, childOrder)) {
    return { containerId: deepest, selectId: deepest };
  }

  return null;
}

/** Shift+click (incl. ⌘/Ctrl+Shift) adds to selection — must not start a drag on pointer down. */
export function isAdditiveSelectionClick(e: {
  shiftKey: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  return e.shiftKey;
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
