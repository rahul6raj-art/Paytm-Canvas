import type { EditorNode, GuideLine } from "@/stores/useEditorStore";
import { computeDragSmartGuides } from "@/lib/dragSmartGuides";

export type SnapResult = { dx: number; dy: number; guides: GuideLine[] };

export function snapBoundsMovement(
  movingIds: string[],
  bounds: { x: number; y: number; width: number; height: number },
  nodes: Record<string, EditorNode>,
  opts?: { gridSize?: number; snapToGrid?: boolean; zoom?: number },
): SnapResult {
  let proposed = { ...bounds };
  if (opts?.snapToGrid) {
    const grid = opts.gridSize ?? 8;
    proposed = {
      ...proposed,
      x: Math.round(proposed.x / grid) * grid,
      y: Math.round(proposed.y / grid) * grid,
    };
  }
  const snap = computeDragSmartGuides(movingIds, proposed, nodes, opts?.zoom ?? 1);
  return { dx: snap.dx, dy: snap.dy, guides: snap.guides };
}
