import type { EditorNode } from "@/stores/useEditorStore";
import { isAncestorOf, topLevelSelectedIds } from "@/lib/editorGraph";
import { nearestAncestorFrameId } from "@/lib/inspectExport";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";
import type { WorldRect } from "@/lib/dragSmartGuides";

export type AltMeasureLine = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  distance: number;
};

export type AltMeasureOverlay = {
  targetBounds: WorldRect;
  targetLabel: string;
  lines: AltMeasureLine[];
};

function unionBounds(rects: WorldRect[]): WorldRect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function verticalOverlap(a: WorldRect, b: WorldRect): boolean {
  return Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
}

function horizontalOverlap(a: WorldRect, b: WorldRect): boolean {
  return Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width);
}

/** Insets from `inner` to `outer` on all four sides (Figma Option + hover parent frame). */
export function insetMeasurements(inner: WorldRect, outer: WorldRect): AltMeasureLine[] {
  const il = inner.x;
  const ir = inner.x + inner.width;
  const it = inner.y;
  const ib = inner.y + inner.height;
  const ol = outer.x;
  const or = outer.x + outer.width;
  const ot = outer.y;
  const ob = outer.y + outer.height;
  const cx = (il + ir) / 2;
  const cy = (it + ib) / 2;

  return [
    {
      key: "l",
      x1: ol,
      y1: cy,
      x2: il,
      y2: cy,
      labelX: (ol + il) / 2,
      labelY: cy - 14,
      distance: Math.round(il - ol),
    },
    {
      key: "t",
      x1: cx,
      y1: ot,
      x2: cx,
      y2: it,
      labelX: cx + 6,
      labelY: (ot + it) / 2 - 8,
      distance: Math.round(it - ot),
    },
    {
      key: "r",
      x1: ir,
      y1: cy,
      x2: or,
      y2: cy,
      labelX: (ir + or) / 2,
      labelY: cy - 14,
      distance: Math.round(or - ir),
    },
    {
      key: "b",
      x1: cx,
      y1: ib,
      x2: cx,
      y2: ob,
      labelX: cx + 6,
      labelY: (ib + ob) / 2 - 8,
      distance: Math.round(ob - ib),
    },
  ];
}

/** Gaps between two layers (Figma Option + hover sibling / other object). */
export function betweenMeasurements(a: WorldRect, b: WorldRect): AltMeasureLine[] {
  const lines: AltMeasureLine[] = [];

  if (verticalOverlap(a, b)) {
    const cy = (Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height)) / 2;
    if (b.x + b.width <= a.x) {
      const gap = a.x - (b.x + b.width);
      lines.push({
        key: "h-left",
        x1: b.x + b.width,
        y1: cy,
        x2: a.x,
        y2: cy,
        labelX: (b.x + b.width + a.x) / 2,
        labelY: cy - 14,
        distance: Math.round(gap),
      });
    } else if (a.x + a.width <= b.x) {
      const gap = b.x - (a.x + a.width);
      lines.push({
        key: "h-right",
        x1: a.x + a.width,
        y1: cy,
        x2: b.x,
        y2: cy,
        labelX: (a.x + a.width + b.x) / 2,
        labelY: cy - 14,
        distance: Math.round(gap),
      });
    }
  }

  if (horizontalOverlap(a, b)) {
    const cx = (Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width)) / 2;
    if (b.y + b.height <= a.y) {
      const gap = a.y - (b.y + b.height);
      lines.push({
        key: "v-top",
        x1: cx,
        y1: b.y + b.height,
        x2: cx,
        y2: a.y,
        labelX: cx + 6,
        labelY: (b.y + b.height + a.y) / 2 - 8,
        distance: Math.round(gap),
      });
    } else if (a.y + a.height <= b.y) {
      const gap = b.y - (a.y + a.height);
      lines.push({
        key: "v-bottom",
        x1: cx,
        y1: a.y + a.height,
        x2: cx,
        y2: b.y,
        labelX: cx + 6,
        labelY: (a.y + a.height + b.y) / 2 - 8,
        distance: Math.round(gap),
      });
    }
  }

  return lines;
}

export function pointInWorldRect(
  px: number,
  py: number,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

/** True when the pointer is over the selected layer(s) bounds (Option → duplicate affordance). */
export function isPointerOverSelection(
  worldX: number,
  worldY: number,
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  const bounds = selectionUnionBounds(selectedIds, nodes);
  if (!bounds) return false;
  return pointInWorldRect(worldX, worldY, bounds);
}

export function selectionUnionBounds(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): WorldRect | null {
  const rects: WorldRect[] = [];
  for (const id of selectedIds) {
    const n = nodes[id];
    if (!n?.visible) continue;
    rects.push(getNodeTransformedWorldBounds(id, nodes));
  }
  return unionBounds(rects);
}

/** Parent frame/group or nearest frame ancestor — used when Option is held without a hover target. */
export function defaultMeasureTargetId(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): string | null {
  const tops = topLevelSelectedIds(selectedIds, nodes);
  for (const id of tops) {
    const parentId = nodes[id]?.parentId;
    if (parentId) {
      const parent = nodes[parentId];
      if (parent?.visible && (parent.type === "frame" || parent.type === "group")) {
        return parentId;
      }
    }
    const frameId = nearestAncestorFrameId(nodes, id);
    if (frameId && nodes[frameId]?.visible) return frameId;
  }
  return null;
}

function resolveMeasureTargetId(
  selectedIds: string[],
  hoverId: string | null,
  nodes: Record<string, EditorNode>,
): string | null {
  if (selectedIds.length === 0) return null;

  const selectedSet = new Set(selectedIds);
  let targetId = hoverId;

  if (targetId && selectedSet.has(targetId)) {
    const parentId = nodes[targetId]?.parentId;
    const parent = parentId ? nodes[parentId] : null;
    if (parent?.visible && (parent.type === "frame" || parent.type === "group")) {
      targetId = parentId;
    } else {
      targetId = null;
    }
  }

  if (!targetId) {
    targetId = defaultMeasureTargetId(selectedIds, nodes);
  }

  if (!targetId || !nodes[targetId]?.visible) return null;
  if (selectedSet.has(targetId)) return null;

  return targetId;
}

export function computeAltMeasureOverlay(
  selectedIds: string[],
  hoverId: string | null,
  nodes: Record<string, EditorNode>,
): AltMeasureOverlay | null {
  if (selectedIds.length === 0) return null;

  const source = selectionUnionBounds(selectedIds, nodes);
  if (!source) return null;

  const targetId = resolveMeasureTargetId(selectedIds, hoverId, nodes);
  if (!targetId) return null;

  const targetBounds = getNodeTransformedWorldBounds(targetId, nodes);
  const selectedSet = new Set(selectedIds);

  const selectionInsideTarget = selectedIds.some((id) => isAncestorOf(nodes, targetId, id));
  const hoverIsDescendantOfSelection =
    hoverId != null && selectedIds.some((id) => isAncestorOf(nodes, id, hoverId));

  let lines: AltMeasureLine[];

  if (selectionInsideTarget) {
    lines = insetMeasurements(source, targetBounds);
  } else if (hoverIsDescendantOfSelection && selectedIds.length === 1) {
    lines = insetMeasurements(targetBounds, source);
  } else {
    lines = betweenMeasurements(source, targetBounds);
    if (
      lines.length === 0 &&
      verticalOverlap(source, targetBounds) &&
      horizontalOverlap(source, targetBounds)
    ) {
      lines = insetMeasurements(source, targetBounds);
    }
  }

  if (lines.length === 0) return null;

  return {
    targetBounds,
    targetLabel: `${Math.round(targetBounds.width)} × ${Math.round(targetBounds.height)}`,
    lines,
  };
}
