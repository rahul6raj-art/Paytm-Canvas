import type { EditorNode, GuideLine } from "@/stores/useEditorStore";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";

const SNAP = 5;

export type SnapResult = { dx: number; dy: number; guides: GuideLine[] };

export function snapBoundsMovement(
  movingIds: string[],
  bounds: { x: number; y: number; width: number; height: number },
  nodes: Record<string, EditorNode>,
  opts?: { gridSize?: number; snapToGrid?: boolean },
): SnapResult {
  const xs: number[] = [];
  const ys: number[] = [];
  const grid = opts?.gridSize ?? 8;

  if (opts?.snapToGrid) {
    for (let g = 0; g <= 6000; g += grid) {
      xs.push(g);
      ys.push(g);
    }
  }

  for (const id of Object.keys(nodes)) {
    if (movingIds.includes(id)) continue;
    const w = getNodeTransformedWorldBounds(id, nodes);
    xs.push(w.x, w.x + w.width / 2, w.x + w.width);
    ys.push(w.y, w.y + w.height / 2, w.y + w.height);
  }

  const probesX = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
  const probesY = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

  let dx = 0;
  let dy = 0;
  let bestX = SNAP + 1;
  let bestY = SNAP + 1;
  const guides: GuideLine[] = [];

  for (const px of probesX) {
    for (const tx of xs) {
      const d = tx - px;
      if (Math.abs(d) < bestX) {
        bestX = Math.abs(d);
        dx = d;
      }
    }
  }
  for (const py of probesY) {
    for (const ty of ys) {
      const d = ty - py;
      if (Math.abs(d) < bestY) {
        bestY = Math.abs(d);
        dy = d;
      }
    }
  }

  if (bestX <= SNAP) guides.push({ axis: "v", pos: bounds.x + dx });
  if (bestY <= SNAP) guides.push({ axis: "h", pos: bounds.y + dy });

  return { dx: bestX <= SNAP ? dx : 0, dy: bestY <= SNAP ? dy : 0, guides };
}
