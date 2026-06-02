import type { LayoutEngineNode, LayoutMode } from "./types";

/** Sort children into visual reading order before layout. */
export function sortIdsForAutoLayoutFlow(
  ids: string[],
  nodes: Record<string, LayoutEngineNode>,
  mode: Exclude<LayoutMode, "none">,
): string[] {
  return [...ids].sort((a, b) => {
    const na = nodes[a]!;
    const nb = nodes[b]!;
    if (mode === "horizontal") {
      const dx = na.x - nb.x;
      if (Math.abs(dx) > 0.5) return dx;
      return na.y - nb.y;
    }
    const dy = na.y - nb.y;
    if (Math.abs(dy) > 0.5) return dy;
    return na.x - nb.x;
  });
}
