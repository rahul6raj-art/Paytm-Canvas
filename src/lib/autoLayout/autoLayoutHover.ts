import { flowChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import { isAutoLayoutContainer, isFlowChild, type LayoutEngineNode } from "@/lib/layoutEngine/types";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

export type AutoLayoutHoverGapGuide = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  gap: number;
};

export type AutoLayoutHoverContext = {
  parentId: string;
  hoveredChildId: string;
  mode: "horizontal" | "vertical";
  childHighlight: { x: number; y: number; width: number; height: number };
  gapGuides: AutoLayoutHoverGapGuide[];
};

function asEngine(n: EditorNode): LayoutEngineNode {
  return n as LayoutEngineNode;
}

/** Gap guides and child highlight when hovering a flow child inside auto layout. */
export function getAutoLayoutHoverContext(
  hoveredId: string | null,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutHoverContext | null {
  if (!hoveredId) return null;
  const hovered = nodes[hoveredId];
  if (!hovered?.visible || hovered.locked || !hovered.parentId) return null;
  if (!isFlowChild(asEngine(hovered))) return null;

  const parent = nodes[hovered.parentId];
  if (!parent || !isAutoLayoutContainer(asEngine(parent))) return null;
  const mode = parent.layoutMode;
  if (mode !== "horizontal" && mode !== "vertical") return null;

  const kids = flowChildIds(
    parent.id,
    nodes as Record<string, LayoutEngineNode>,
    childOrder,
  );
  const idx = kids.indexOf(hoveredId);
  if (idx < 0) return null;

  const gap = parent.layoutGap ?? 0;
  const childBounds = getRenderedWorldBounds(hoveredId, nodes, childOrder);
  const gapGuides: AutoLayoutHoverGapGuide[] = [];

  const addGap = (aId: string, bId: string) => {
    const a = getRenderedWorldBounds(aId, nodes, childOrder);
    const b = getRenderedWorldBounds(bId, nodes, childOrder);
    if (mode === "horizontal") {
      const x = (a.x + a.width + b.x) / 2;
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y + a.height, b.y + b.height);
      gapGuides.push({ x1: x, y1, x2: x, y2, gap });
    } else {
      const y = (a.y + a.height + b.y) / 2;
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x + a.width, b.x + b.width);
      gapGuides.push({ x1, y1: y, x2, y2: y, gap });
    }
  };

  if (idx > 0) addGap(kids[idx - 1]!, hoveredId);
  if (idx < kids.length - 1) addGap(hoveredId, kids[idx + 1]!);

  return {
    parentId: parent.id,
    hoveredChildId: hoveredId,
    mode,
    childHighlight: childBounds,
    gapGuides,
  };
}
