import type { FigMaskType } from "@/lib/mask/types";
import { normalizeFigMaskType } from "@/lib/mask/types";
import type { EditorNode } from "@/stores/useEditorStore";

export type MaskGroupPersisted = {
  type: "group";
  maskId: string;
  figMaskType?: FigMaskType;
  maskVisible?: boolean;
  children: string[];
};

export function maskFieldsFromNode(
  node: EditorNode,
  childIds: string[],
): MaskGroupPersisted | null {
  if (node.type !== "group" || !node.maskId) return null;
  return {
    type: "group",
    maskId: node.maskId,
    figMaskType: normalizeFigMaskType(node.figMaskType),
    maskVisible: node.maskVisible,
    children: childIds,
  };
}

export function applyMaskFieldsToNode(
  node: EditorNode,
  persisted: Partial<MaskGroupPersisted>,
): EditorNode {
  return {
    ...node,
    maskId: persisted.maskId ?? node.maskId,
    figMaskType: persisted.figMaskType ?? node.figMaskType,
    maskVisible: persisted.maskVisible ?? node.maskVisible,
  };
}
