import { flowChildIds } from "./layoutGraph";
import { isAutoLayoutContainer, type LayoutEngineNode, type LayoutMode } from "./types";

export type FrozenLayoutGap = Pick<LayoutEngineNode, "layoutGap" | "layoutGapAuto">;

/** Median spacing between adjacent flow children (Figma “Auto” gap). */
export function inferAutoLayoutGap(
  nodes: Record<string, LayoutEngineNode>,
  childIds: string[],
  mode: Exclude<LayoutMode, "none">,
): number {
  if (childIds.length < 2) return 0;
  const gaps: number[] = [];
  for (let i = 0; i < childIds.length - 1; i++) {
    const a = nodes[childIds[i]!]!;
    const b = nodes[childIds[i + 1]!]!;
    if (!a || !b) continue;
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
 * Snapshot the effective gap (inferred when Auto is on) before turning it off.
 * Prevents relayout from snapping to a stale stored layoutGap (often 0).
 */
export function freezeAutoLayoutGap(
  parent: LayoutEngineNode | undefined,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
): FrozenLayoutGap | null {
  if (!parent || !isAutoLayoutContainer(parent)) return null;
  if (!parent.layoutGapAuto) return null;

  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  const kids = flowChildIds(parent.id, nodes, childOrder);
  const preservedGap = resolveLayoutGap(parent, kids, nodes, mode);
  return { layoutGapAuto: false, layoutGap: preservedGap };
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
): FrozenLayoutGap | null {
  if (!parent || !isAutoLayoutContainer(parent)) return null;
  if (!parent.layoutGapAuto) return null;

  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  const kids = flowChildIds(parent.id, nodes, childOrder).filter(
    (id) => id !== incomingChildId,
  );
  const preservedGap = resolveLayoutGap(parent, kids, nodes, mode);
  return { layoutGapAuto: false, layoutGap: preservedGap };
}
