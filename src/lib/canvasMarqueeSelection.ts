import { isAncestorOf } from "@/lib/editorGraph";
import { rectsIntersect } from "@/lib/rectHit";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

export type WorldMarqueeRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export function normalizeMarqueeRect(m: WorldMarqueeRect): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const x = Math.min(m.x0, m.x1);
  const y = Math.min(m.y0, m.y1);
  return {
    x,
    y,
    width: Math.abs(m.x1 - m.x0),
    height: Math.abs(m.y1 - m.y0),
  };
}

/** Layers whose bounds intersect the marquee; keeps top-most nodes only (no child if parent is included). */
export function pickNodesInMarquee(
  nodes: Record<string, EditorNode>,
  marquee: WorldMarqueeRect,
): string[] {
  const box = normalizeMarqueeRect(marquee);
  if (box.width <= 0 && box.height <= 0) return [];

  const picked: string[] = [];
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!n?.visible || n.locked) continue;
    const bounds = getNodeTransformedWorldBounds(id, nodes);
    if (!rectsIntersect(bounds, box)) continue;
    picked.push(id);
  }

  return picked.filter(
    (id) => !picked.some((other) => other !== id && isAncestorOf(nodes, other, id)),
  );
}

export function selectionIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

export function mergeMarqueeSelection(base: string[], picked: string[], shiftKey: boolean): string[] {
  if (!shiftKey) return picked;
  return [...new Set([...base, ...picked])];
}
