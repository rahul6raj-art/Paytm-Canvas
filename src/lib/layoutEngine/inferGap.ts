import { flowChildIds } from "./layoutAutoNode";
import { sortIdsForAutoLayoutFlow } from "./flowOrder";
import { isAutoLayoutContainer, type LayoutEngineNode, type LayoutMode } from "./types";

/** Median spacing between adjacent flow children (Figma “Auto” gap). */
export function inferAutoLayoutGap(
  nodes: Record<string, LayoutEngineNode>,
  childIds: string[],
  mode: Exclude<LayoutMode, "none">,
): number {
  if (childIds.length < 2) return 0;
  const sorted = sortIdsForAutoLayoutFlow(childIds, nodes, mode);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = nodes[sorted[i]!]!;
    const b = nodes[sorted[i + 1]!]!;
    if (mode === "horizontal") {
      const g = b.x - (a.x + a.width);
      if (g >= 0 && g < 800) gaps.push(g);
    } else {
      const g = b.y - (a.y + a.height);
      if (g >= 0 && g < 800) gaps.push(g);
    }
  }
  if (gaps.length === 0) return 0;
  gaps.sort((x, y) => x - y);
  return Math.round(gaps[Math.floor(gaps.length / 2)]!);
}

export function resolveLayoutGap(
  parent: Pick<LayoutEngineNode, "layoutGap" | "layoutGapAuto">,
  childIds: string[],
  nodes: Record<string, LayoutEngineNode>,
  mode: Exclude<LayoutMode, "none">,
): number {
  if (parent.layoutGapAuto) {
    return inferAutoLayoutGap(nodes, childIds, mode);
  }
  return parent.layoutGap ?? 0;
}

/**
 * When inserting a child into auto-layout, freeze the current effective gap so
 * relayout does not re-infer spacing from the dropped node's transient position.
 */
export function freezeAutoLayoutGapBeforeChildInsert(
  parent: LayoutEngineNode | undefined,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  incomingChildId: string,
): Pick<LayoutEngineNode, "layoutGap" | "layoutGapAuto"> | null {
  if (!parent || !isAutoLayoutContainer(parent)) return null;
  if (!parent.layoutGapAuto) return null;

  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  const kids = flowChildIds(parent.id, nodes, childOrder).filter(
    (id) => id !== incomingChildId,
  );
  const preservedGap = resolveLayoutGap(parent, kids, nodes, mode);
  return { layoutGapAuto: false, layoutGap: preservedGap };
}
