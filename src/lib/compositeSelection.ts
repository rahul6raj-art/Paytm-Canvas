import { isBooleanGroup, isMaskGroup } from "@/lib/booleanGeometry";
import { shouldShowMaskLayer } from "@/lib/mask/isMaskGroup";
import type { EditorNode } from "@/stores/useEditorStore";

/** Nearest boolean or mask group ancestor. */
export function findEnclosingCompositeGroup(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): string | null {
  let cur = nodes[nodeId]?.parentId;
  while (cur) {
    const p = nodes[cur];
    if (!p) break;
    if (isBooleanGroup(p) || isMaskGroup(p)) return cur;
    cur = p.parentId;
  }
  return null;
}

export type CompositeSelectionOpts = {
  objectEditModeNodeId?: string | null;
  selectedIds?: readonly string[];
};

/**
 * Operand / mask layer that is folded into a composite preview and should not
 * get its own selection or drag ghost frame.
 */
export function isCompositeHiddenOperand(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  opts?: CompositeSelectionOpts,
): boolean {
  const objectEditModeNodeId = opts?.objectEditModeNodeId ?? null;
  const selectedIds = opts?.selectedIds ?? [];
  const compositeId = findEnclosingCompositeGroup(nodeId, nodes);
  if (!compositeId) return false;
  if (objectEditModeNodeId === compositeId) return false;

  const composite = nodes[compositeId]!;
  if (isBooleanGroup(composite)) return true;

  if (isMaskGroup(composite) && composite.maskId === nodeId) {
    return !shouldShowMaskLayer(composite, { objectEditModeNodeId, selectedIds: [...selectedIds] });
  }

  return false;
}

/** World-bounds target for selection / hover outlines. */
export function compositeSelectionBoundsId(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  opts?: CompositeSelectionOpts,
): string {
  if (!isCompositeHiddenOperand(nodeId, nodes, opts)) return nodeId;
  return findEnclosingCompositeGroup(nodeId, nodes)!;
}

/**
 * While dragging composite-hidden operands, temporarily render the parent in
 * object-edit mode so the SVG scene follows the pointer instead of a lone ghost.
 */
export function compositeEditModeForDrag(
  movingIds: readonly string[],
  nodes: Record<string, EditorNode>,
  objectEditModeNodeId: string | null | undefined,
): string | null {
  if (objectEditModeNodeId) return objectEditModeNodeId;
  for (const id of movingIds) {
    if (!isCompositeHiddenOperand(id, nodes)) continue;
    const compositeId = findEnclosingCompositeGroup(id, nodes);
    if (compositeId) return compositeId;
  }
  return null;
}
