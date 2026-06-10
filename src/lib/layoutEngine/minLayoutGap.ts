import { flowChildIds } from "./layoutAutoNode";
import { measureNode, type MeasureContext } from "./measure";
import type { LayoutEngineNode } from "./types";

/**
 * Most negative uniform item spacing before the last flow child would move past
 * the frame's inner start edge (padding top for vertical, padding left for horizontal).
 */
export function computeMinLayoutGap(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
): number {
  const parent = nodes[parentId];
  if (!parent) return 0;
  const mode = parent.layoutMode;
  if (mode !== "horizontal" && mode !== "vertical") return 0;

  const kids = flowChildIds(parentId, nodes, childOrder);
  if (kids.length < 2) return 0;

  const ctx: MeasureContext = { nodes, childOrder };
  let sumLeading = 0;
  for (let i = 0; i < kids.length - 1; i++) {
    sumLeading += measureNode(kids[i]!, ctx, mode).main;
  }
  return -Math.round(sumLeading / (kids.length - 1));
}
