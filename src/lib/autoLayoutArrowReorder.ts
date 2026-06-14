import { flowChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import { isFlowChild, type LayoutEngineNode, type LayoutMode } from "@/lib/layoutEngine/types";
import type { EditorNode } from "@/stores/useEditorStore";

export type AutoLayoutArrowReorderContext = {
  parentId: string;
  childId: string;
  mode: Exclude<LayoutMode, "none">;
};

function asEngine(n: EditorNode): LayoutEngineNode {
  return n as LayoutEngineNode;
}

export function isAutoLayoutContainerNode(
  node: Pick<EditorNode, "type" | "layoutMode"> | undefined,
): boolean {
  if (!node || (node.type !== "frame" && node.type !== "group")) return false;
  return (node.layoutMode ?? "none") !== "none";
}

/** Single selected flow child inside an auto-layout parent. */
export function getAutoLayoutArrowReorderContext(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutArrowReorderContext | null {
  if (selectedIds.length !== 1) return null;
  const childId = selectedIds[0]!;
  const child = nodes[childId];
  if (!child?.parentId || child.locked || !child.visible) return null;
  if (!isFlowChild(asEngine(child))) return null;

  const parent = nodes[child.parentId];
  if (!isAutoLayoutContainerNode(parent)) return null;
  const mode = parent!.layoutMode;
  if (mode !== "horizontal" && mode !== "vertical") return null;

  const flowKids = flowChildIds(child.parentId, nodes as Record<string, LayoutEngineNode>, childOrder);
  if (!flowKids.includes(childId)) return null;

  return { parentId: child.parentId, childId, mode };
}

/** Primary-axis arrow delta for reorder (-1 earlier, +1 later, 0 unsupported). */
export function autoLayoutArrowReorderDelta(
  mode: Exclude<LayoutMode, "none">,
  arrowCode: string,
): -1 | 0 | 1 {
  if (mode === "horizontal") {
    if (arrowCode === "ArrowLeft") return -1;
    if (arrowCode === "ArrowRight") return 1;
    return 0;
  }
  if (arrowCode === "ArrowUp") return -1;
  if (arrowCode === "ArrowDown") return 1;
  return 0;
}

/** Target insert index in the parent's child list, or null if no move. */
export function computeAutoLayoutArrowReorderIndex(
  ctx: AutoLayoutArrowReorderContext,
  arrowCode: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  shiftKey = false,
): number | null {
  const delta = autoLayoutArrowReorderDelta(ctx.mode, arrowCode);
  if (delta === 0) return null;

  const flowKids = flowChildIds(
    ctx.parentId,
    nodes as Record<string, LayoutEngineNode>,
    childOrder,
  );
  const flowIdx = flowKids.indexOf(ctx.childId);
  if (flowIdx < 0) return null;

  const fullList = childOrder[ctx.parentId] ?? [];

  if (shiftKey) {
    const targetFlowIdx = delta < 0 ? 0 : flowKids.length - 1;
    if (targetFlowIdx === flowIdx) return null;
    const anchorId = flowKids[targetFlowIdx]!;
    const anchorFullIdx = fullList.indexOf(anchorId);
    if (anchorFullIdx < 0) return null;
    return delta < 0 ? anchorFullIdx : anchorFullIdx + 1;
  }

  const nextFlowIdx = flowIdx + delta;
  if (nextFlowIdx < 0 || nextFlowIdx >= flowKids.length) return null;

  const neighborId = flowKids[nextFlowIdx]!;
  const neighborFullIdx = fullList.indexOf(neighborId);
  if (neighborFullIdx < 0) return null;

  return delta < 0 ? neighborFullIdx : neighborFullIdx + 1;
}

/** @deprecated Perpendicular nudge is allowed; flow children detach to absolute on nudge. */
export function autoLayoutArrowBlocksNudge(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  arrowCode: string,
): boolean {
  const ctx = getAutoLayoutArrowReorderContext(selectedIds, nodes, childOrder);
  if (!ctx) return false;
  return autoLayoutArrowReorderDelta(ctx.mode, arrowCode) === 0;
}

export function swapAutoLayoutSiblingOrder(
  parentId: string,
  idA: string,
  idB: string,
  childOrder: Record<string, string[]>,
): Record<string, string[]> | null {
  const list = [...(childOrder[parentId] ?? [])];
  const iA = list.indexOf(idA);
  const iB = list.indexOf(idB);
  if (iA < 0 || iB < 0) return null;
  [list[iA], list[iB]] = [list[iB]!, list[iA]!];
  return { ...childOrder, [parentId]: list };
}

/** Whether two siblings can swap order inside an auto-layout parent. */
export function canSwapAutoLayoutSiblings(
  idA: string,
  idB: string,
  nodes: Record<string, EditorNode>,
): boolean {
  if (idA === idB) return false;
  const a = nodes[idA];
  const b = nodes[idB];
  if (!a || !b || a.parentId !== b.parentId || !a.parentId) return false;
  if (a.locked || b.locked || !a.visible || !b.visible) return false;
  if (!isFlowChild(asEngine(a)) || !isFlowChild(asEngine(b))) return false;
  return isAutoLayoutContainerNode(nodes[a.parentId]);
}
