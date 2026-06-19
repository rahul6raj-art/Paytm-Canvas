import type { EditorNode } from "@/stores/useEditorStore";

/** Group with a dedicated mask child (`maskId`). */
export function isMaskGroup(node: EditorNode | undefined): boolean {
  return Boolean(node?.type === "group" && node.maskId);
}

/** Boolean group (never a mask group). */
export function isBooleanGroup(node: EditorNode | undefined): boolean {
  return Boolean(node?.type === "group" && node.isBooleanGroup && !node.maskId);
}

/** Content child ids — all children except the mask shape. */
export function maskGroupContentChildIds(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
): string[] {
  const g = nodes[groupId];
  if (!g?.maskId) return childIds;
  return childIds.filter((id) => id !== g.maskId);
}

/** Paint order for hit tests: masked content above mask shape (Figma). */
export function maskGroupChildHitOrder(
  parent: Pick<EditorNode, "type" | "maskId">,
  childIds: string[],
): string[] {
  if (parent.type !== "group" || !parent.maskId) return childIds;
  const maskId = parent.maskId;
  const content = childIds.filter((id) => id !== maskId);
  return [...content, maskId];
}

export function shouldShowMaskLayer(
  group: EditorNode,
  opts?: { objectEditModeNodeId?: string | null; selectedIds?: readonly string[] },
): boolean {
  if (!group.maskId) return false;
  if (group.maskVisible) return true;
  if (opts?.objectEditModeNodeId === group.id) return true;
  if (opts?.selectedIds?.includes(group.maskId)) return true;
  return false;
}
