import type { LayoutNode } from "@/lib/autoLayout";

type NodeLike = Pick<LayoutNode, "parentId" | "layoutPositioning">;
type ParentLike = Pick<LayoutNode, "layoutMode">;

/**
 * Flow children inside auto-layout must use absolute positioning before manual x/y drag
 * (Figma-style). Returns ids that need `layoutPositioning: "absolute"`.
 */
export function idsToDetachForAutoLayoutDrag(
  nodeIds: string[],
  nodes: Record<string, NodeLike>,
  parents: Record<string, ParentLike>,
): string[] {
  const out: string[] = [];
  for (const id of nodeIds) {
    const n = nodes[id];
    if (!n?.parentId) continue;
    const parent = parents[n.parentId];
    if (!parent || (parent.layoutMode ?? "none") === "none") continue;
    if ((n.layoutPositioning ?? "auto") === "absolute") continue;
    out.push(id);
  }
  return out;
}
