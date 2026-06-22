import type { EditorNode } from "@/stores/useEditorStore";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import { alignableSelectionIds } from "@/lib/alignSelection";
import type { RectBounds } from "@/lib/transformMath";

export type SelectionSpacingHandle = {
  axis: "horizontal" | "vertical";
  index: number;
  /** Layer on the leading side of the gap (left / top). */
  beforeId: string;
  /** Layer on the trailing side — moves with the handle drag. */
  afterId: string;
  /** Sorted layer ids along this axis (includes all alignable selection). */
  sortedIds: string[];
  gap: number;
  worldX: number;
  worldY: number;
  lineA: { x: number; y: number };
  lineB: { x: number; y: number };
};

function verticalOverlap(a: RectBounds, b: RectBounds): boolean {
  return Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
}

function horizontalOverlap(a: RectBounds, b: RectBounds): boolean {
  return Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width);
}

function measureGapBetween(
  before: RectBounds,
  after: RectBounds,
  axis: "horizontal" | "vertical",
): number {
  if (axis === "horizontal") {
    return after.x - (before.x + before.width);
  }
  return after.y - (before.y + before.height);
}

function gapMidpoint(
  before: RectBounds,
  after: RectBounds,
  axis: "horizontal" | "vertical",
): { x: number; y: number; lineA: { x: number; y: number }; lineB: { x: number; y: number } } {
  if (axis === "horizontal") {
    const y =
      (Math.max(before.y, after.y) +
        Math.min(before.y + before.height, after.y + after.height)) /
      2;
    const x1 = before.x + before.width;
    const x2 = after.x;
    return {
      x: (x1 + x2) / 2,
      y,
      lineA: { x: x1, y },
      lineB: { x: x2, y },
    };
  }
  const x =
    (Math.max(before.x, after.x) +
      Math.min(before.x + before.width, after.x + after.width)) /
    2;
  const y1 = before.y + before.height;
  const y2 = after.y;
  return {
    x,
    y: (y1 + y2) / 2,
    lineA: { x, y: y1 },
    lineB: { x, y: y2 },
  };
}

function handlesForAxis(
  ids: string[],
  bounds: Record<string, RectBounds>,
  axis: "horizontal" | "vertical",
): SelectionSpacingHandle[] {
  const sorted = [...ids].sort((a, b) => {
    const ba = bounds[a]!;
    const bb = bounds[b]!;
    if (axis === "horizontal") {
      const ca = ba.x + ba.width / 2;
      const cb = bb.x + bb.width / 2;
      return ca !== cb ? ca - cb : ba.x - bb.x;
    }
    const ca = ba.y + ba.height / 2;
    const cb = bb.y + bb.height / 2;
    return ca !== cb ? ca - cb : ba.y - bb.y;
  });

  const out: SelectionSpacingHandle[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const beforeId = sorted[i]!;
    const afterId = sorted[i + 1]!;
    const before = bounds[beforeId]!;
    const after = bounds[afterId]!;
    const overlaps = axis === "horizontal" ? verticalOverlap(before, after) : horizontalOverlap(before, after);
    if (!overlaps) continue;
    const gap = measureGapBetween(before, after, axis);
    const mid = gapMidpoint(before, after, axis);
    out.push({
      axis,
      index: i,
      beforeId,
      afterId,
      sortedIds: sorted,
      gap,
      worldX: mid.x,
      worldY: mid.y,
      lineA: mid.lineA,
      lineB: mid.lineB,
    });
  }
  return out;
}

/** Pink gap handles between adjacent selected layers (Figma multi-select spacing). */
export function getSelectionSpacingHandles(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): SelectionSpacingHandle[] {
  const ids = alignableSelectionIds(selectedIds, nodes);
  if (ids.length < 2) return [];

  const bounds: Record<string, RectBounds> = {};
  for (const id of ids) {
    bounds[id] = getRenderedWorldBounds(id, nodes, childOrder);
  }

  return [
    ...handlesForAxis(ids, bounds, "horizontal"),
    ...handlesForAxis(ids, bounds, "vertical"),
  ];
}

export function idsMovedBySelectionGapDrag(
  handle: Pick<SelectionSpacingHandle, "sortedIds" | "index">,
): string[] {
  return handle.sortedIds.slice(handle.index + 1);
}
