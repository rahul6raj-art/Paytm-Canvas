import { sortIdsForAutoLayoutFlow } from "./flowOrder";
import type { LayoutEngineNode, LayoutMode } from "./types";

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
