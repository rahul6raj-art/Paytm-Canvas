import { flowChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import {
  childMainSizing,
  isAutoLayoutContainer,
  paddingBox,
  type LayoutEngineNode,
  type LayoutMode,
  type LayoutSizingMode,
} from "@/lib/layoutEngine/types";
import type { EditorNode } from "@/stores/useEditorStore";

export type PaddingSide = "top" | "right" | "bottom" | "left";

export type SpacingHandle = {
  kind: "spacing";
  /** Gap segment between flow child at index and index + 1 */
  index: number;
  localX: number;
  localY: number;
};

export type PaddingHandle = {
  kind: "padding";
  side: PaddingSide;
  localX: number;
  localY: number;
};

export type FillDividerHandle = {
  kind: "fill-divider";
  /** Index of the earlier child on the primary axis */
  index: number;
  leftChildId: string;
  rightChildId: string;
  localX: number;
  localY: number;
};

export type AutoLayoutInteractionHandles = {
  mode: Exclude<LayoutMode, "none">;
  spacing: SpacingHandle[];
  padding: PaddingHandle[];
  fillDividers: FillDividerHandle[];
};

function asEngineNode(n: EditorNode): LayoutEngineNode {
  return n as LayoutEngineNode;
}

function mainSizing(child: EditorNode, mode: Exclude<LayoutMode, "none">): LayoutSizingMode {
  return childMainSizing(asEngineNode(child), mode);
}

/** Compute Figma-style on-canvas spacing, padding, and fill divider handles (parent-local coords). */
export function getAutoLayoutInteractionHandles(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutInteractionHandles | null {
  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainer(asEngineNode(parent))) return null;

  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  const pad = paddingBox(asEngineNode(parent));
  const innerW = Math.max(0, parent.width - pad.left - pad.right);
  const innerH = Math.max(0, parent.height - pad.top - pad.bottom);
  const innerCenterX = pad.left + innerW / 2;
  const innerCenterY = pad.top + innerH / 2;

  const kids = flowChildIds(parentId, nodes, childOrder);
  const spacing: SpacingHandle[] = [];
  const fillDividers: FillDividerHandle[] = [];

  for (let i = 0; i < kids.length - 1; i++) {
    const a = nodes[kids[i]!];
    const b = nodes[kids[i + 1]!];
    if (!a || !b) continue;

    if (mode === "horizontal") {
      const midX = a.x + a.width + (b.x - (a.x + a.width)) / 2;
      spacing.push({ kind: "spacing", index: i, localX: midX, localY: innerCenterY });

      const aFill = mainSizing(a, mode) === "fill";
      const bFill = mainSizing(b, mode) === "fill";
      if (aFill || bFill) {
        fillDividers.push({
          kind: "fill-divider",
          index: i,
          leftChildId: kids[i]!,
          rightChildId: kids[i + 1]!,
          localX: a.x + a.width,
          localY: innerCenterY,
        });
      }
    } else {
      const midY = a.y + a.height + (b.y - (a.y + a.height)) / 2;
      spacing.push({ kind: "spacing", index: i, localX: innerCenterX, localY: midY });

      const aFill = mainSizing(a, mode) === "fill";
      const bFill = mainSizing(b, mode) === "fill";
      if (aFill || bFill) {
        fillDividers.push({
          kind: "fill-divider",
          index: i,
          leftChildId: kids[i]!,
          rightChildId: kids[i + 1]!,
          localX: innerCenterX,
          localY: a.y + a.height,
        });
      }
    }
  }

  const padding: PaddingHandle[] = [
    { kind: "padding", side: "top", localX: innerCenterX, localY: pad.top / 2 },
    { kind: "padding", side: "right", localX: parent.width - pad.right / 2, localY: innerCenterY },
    { kind: "padding", side: "bottom", localX: innerCenterX, localY: parent.height - pad.bottom / 2 },
    { kind: "padding", side: "left", localX: pad.left / 2, localY: innerCenterY },
  ];

  return { mode, spacing, padding, fillDividers };
}
