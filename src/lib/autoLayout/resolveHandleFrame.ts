import { isAutoLayoutContainerNode } from "@/lib/autoLayoutArrowReorder";
import type { EditorNode } from "@/stores/useEditorStore";

/** Frame that should show spacing/padding handles for the current selection. */
export function resolveAutoLayoutHandleFrameId(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): string | null {
  if (selectedIds.length !== 1) return null;
  const id = selectedIds[0]!;
  const node = nodes[id];
  if (!node || node.locked || !node.visible) return null;

  if (
    (node.type === "frame" || node.type === "group") &&
    isAutoLayoutContainerNode(node)
  ) {
    return id;
  }

  const parentId = node.parentId;
  if (!parentId) return null;
  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainerNode(parent)) return null;
  if ((node.layoutPositioning ?? "auto") === "absolute") return null;
  return parentId;
}
