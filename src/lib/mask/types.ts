import type { EditorNode } from "@/stores/useEditorStore";

export type FigMaskType = "OUTLINE" | "LUMINANCE" | "ALPHA";

export type MaskClipPathResult = {
  clipD: string;
  clipRule: "nonzero" | "evenodd";
};

export type ExactPathD = {
  pathD: string;
  fillRule: "nonzero" | "evenodd";
};

export type MaskGroupModel = {
  id: string;
  type: "group";
  maskId: string;
  figMaskType: FigMaskType;
  children: string[];
  maskVisible?: boolean;
};

export type MaskCompositorMode = FigMaskType;

export function normalizeFigMaskType(raw: string | undefined): FigMaskType {
  const u = (raw ?? "OUTLINE").toUpperCase();
  if (u === "LUMINANCE" || u === "ALPHA") return u;
  return "OUTLINE";
}

export function maskGroupModelFromNode(
  node: EditorNode,
  childIds: string[],
): MaskGroupModel | null {
  if (node.type !== "group" || !node.maskId) return null;
  return {
    id: node.id,
    type: "group",
    maskId: node.maskId,
    figMaskType: normalizeFigMaskType(node.figMaskType),
    children: childIds,
    maskVisible: node.maskVisible,
  };
}
