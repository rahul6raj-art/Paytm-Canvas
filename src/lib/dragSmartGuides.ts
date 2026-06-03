import type { EditorNode, GuideLine } from "@/stores/useEditorStore";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";

export type WorldRect = { x: number; y: number; width: number; height: number };

export type DragMeasurementLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distance: number;
};

export type DragSnapOverlay = {
  guides: GuideLine[];
  measurements: DragMeasurementLine[];
};

const MEASURE_MAX_GAP = 600;
const ALIGN_EPS = 0.5;

function isDescendantOf(
  nodes: Record<string, EditorNode>,
  nodeId: string,
  ancestorId: string,
): boolean {
  let cur: string | null = nodes[nodeId]?.parentId ?? null;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

function shouldExcludeStatic(
  id: string,
  movingSet: Set<string>,
  nodes: Record<string, EditorNode>,
): boolean {
  if (movingSet.has(id)) return true;
  for (const mid of movingSet) {
    if (isDescendantOf(nodes, id, mid)) return true;
    if (isDescendantOf(nodes, mid, id)) return true;
  }
  const n = nodes[id];
  return !n?.visible;
}

function collectStaticRects(
  movingIds: string[],
  nodes: Record<string, EditorNode>,
): WorldRect[] {
  const movingSet = new Set(movingIds);
  const out: WorldRect[] = [];
  for (const id of Object.keys(nodes)) {
    if (shouldExcludeStatic(id, movingSet, nodes)) continue;
    out.push(getNodeTransformedWorldBounds(id, nodes));
  }
  return out;
}

function unionRects(rects: WorldRect[]): WorldRect {
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
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function verticalOverlap(a: WorldRect, b: WorldRect): boolean {
  return Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
}

function horizontalOverlap(a: WorldRect, b: WorldRect): boolean {
  return Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width);
}

function midY(a: WorldRect, b: WorldRect): number {
  const top = Math.max(a.y, b.y);
  const bot = Math.min(a.y + a.height, b.y + b.height);
  return (top + bot) / 2;
}

function midX(a: WorldRect, b: WorldRect): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  return (left + right) / 2;
}

/** Figma-style snap + alignment guides + gap measurements while dragging. */
export function computeDragSmartGuides(
  movingIds: string[],
  proposedBounds: WorldRect,
  nodes: Record<string, EditorNode>,
  zoom: number,
): DragSnapOverlay & { dx: number; dy: number } {
  const snapThreshold = screenPxToWorld(5, zoom);
  const statics = collectStaticRects(movingIds, nodes);

  const probesX = [
    proposedBounds.x,
    proposedBounds.x + proposedBounds.width / 2,
    proposedBounds.x + proposedBounds.width,
  ];
  const probesY = [
    proposedBounds.y,
    proposedBounds.y + proposedBounds.height / 2,
    proposedBounds.y + proposedBounds.height,
  ];

  const targetsX: number[] = [];
  const targetsY: number[] = [];
  for (const s of statics) {
    targetsX.push(s.x, s.x + s.width / 2, s.x + s.width);
    targetsY.push(s.y, s.y + s.height / 2, s.y + s.height);
  }

  let dx = 0;
  let dy = 0;
  let bestX = snapThreshold + 1;
  let bestY = snapThreshold + 1;

  for (const px of probesX) {
    for (const tx of targetsX) {
      const d = tx - px;
      if (Math.abs(d) < bestX) {
        bestX = Math.abs(d);
        dx = d;
      }
    }
  }
  for (const py of probesY) {
    for (const ty of targetsY) {
      const d = ty - py;
      if (Math.abs(d) < bestY) {
        bestY = Math.abs(d);
        dy = d;
      }
    }
  }

  const snapDx = bestX <= snapThreshold ? dx : 0;
  const snapDy = bestY <= snapThreshold ? dy : 0;

  const finalBounds: WorldRect = {
    ...proposedBounds,
    x: proposedBounds.x + snapDx,
    y: proposedBounds.y + snapDy,
  };

  const allRects = [...statics, finalBounds];
  const guides: GuideLine[] = [];
  const guideKeys = new Set<string>();

  const addGuide = (axis: "v" | "h", pos: number, from: number, to: number) => {
    const key = `${axis}:${Math.round(pos * 100)}:${Math.round(from)}:${Math.round(to)}`;
    if (guideKeys.has(key)) return;
    guideKeys.add(key);
    guides.push({ axis, pos, from, to });
  };

  const alignedSpan = (axis: "v" | "h", pos: number): [number, number] => {
    let from = Infinity;
    let to = -Infinity;
    for (const r of allRects) {
      const edges =
        axis === "v"
          ? [r.x, r.x + r.width / 2, r.x + r.width]
          : [r.y, r.y + r.height / 2, r.y + r.height];
      if (!edges.some((e) => Math.abs(e - pos) <= ALIGN_EPS)) continue;
      if (axis === "v") {
        from = Math.min(from, r.y);
        to = Math.max(to, r.y + r.height);
      } else {
        from = Math.min(from, r.x);
        to = Math.max(to, r.x + r.width);
      }
    }
    if (!Number.isFinite(from)) return [finalBounds.y, finalBounds.y + finalBounds.height];
    return [from, to];
  };

  const xEdges = [
    finalBounds.x,
    finalBounds.x + finalBounds.width / 2,
    finalBounds.x + finalBounds.width,
  ];
  const yEdges = [
    finalBounds.y,
    finalBounds.y + finalBounds.height / 2,
    finalBounds.y + finalBounds.height,
  ];

  for (const s of statics) {
    for (const xe of [s.x, s.x + s.width / 2, s.x + s.width]) {
      if (xEdges.some((e) => Math.abs(e - xe) <= ALIGN_EPS)) {
        const [from, to] = alignedSpan("v", xe);
        addGuide("v", xe, from, to);
      }
    }
    for (const ye of [s.y, s.y + s.height / 2, s.y + s.height]) {
      if (yEdges.some((e) => Math.abs(e - ye) <= ALIGN_EPS)) {
        const [from, to] = alignedSpan("h", ye);
        addGuide("h", ye, from, to);
      }
    }
  }

  const measurements: DragMeasurementLine[] = [];
  const measureKeys = new Set<string>();

  const addMeasure = (m: DragMeasurementLine) => {
    const key = `${Math.round(m.x1)}:${Math.round(m.y1)}:${Math.round(m.x2)}:${Math.round(m.y2)}`;
    if (measureKeys.has(key)) return;
    measureKeys.add(key);
    measurements.push(m);
  };

  for (const s of statics) {
    if (verticalOverlap(finalBounds, s)) {
      const my = midY(finalBounds, s);
      if (s.x + s.width <= finalBounds.x + ALIGN_EPS) {
        const gap = finalBounds.x - (s.x + s.width);
        if (gap > 0 && gap <= MEASURE_MAX_GAP) {
          addMeasure({
            x1: s.x + s.width,
            y1: my,
            x2: finalBounds.x,
            y2: my,
            distance: Math.round(gap),
          });
        }
      }
      if (s.x >= finalBounds.x + finalBounds.width - ALIGN_EPS) {
        const gap = s.x - (finalBounds.x + finalBounds.width);
        if (gap > 0 && gap <= MEASURE_MAX_GAP) {
          addMeasure({
            x1: finalBounds.x + finalBounds.width,
            y1: my,
            x2: s.x,
            y2: my,
            distance: Math.round(gap),
          });
        }
      }
    }
    if (horizontalOverlap(finalBounds, s)) {
      const mx = midX(finalBounds, s);
      if (s.y + s.height <= finalBounds.y + ALIGN_EPS) {
        const gap = finalBounds.y - (s.y + s.height);
        if (gap > 0 && gap <= MEASURE_MAX_GAP) {
          addMeasure({
            x1: mx,
            y1: s.y + s.height,
            x2: mx,
            y2: finalBounds.y,
            distance: Math.round(gap),
          });
        }
      }
      if (s.y >= finalBounds.y + finalBounds.height - ALIGN_EPS) {
        const gap = s.y - (finalBounds.y + finalBounds.height);
        if (gap > 0 && gap <= MEASURE_MAX_GAP) {
          addMeasure({
            x1: mx,
            y1: finalBounds.y + finalBounds.height,
            x2: mx,
            y2: s.y,
            distance: Math.round(gap),
          });
        }
      }
    }
  }

  return {
    dx: snapDx,
    dy: snapDy,
    guides,
    measurements,
  };
}

export function proposedBoundsForMoving(
  movingIds: string[],
  startBounds: Record<string, WorldRect>,
  fdx: number,
  fdy: number,
): WorldRect {
  const shifted = movingIds.map((id) => {
    const b = startBounds[id]!;
    return { x: b.x + fdx, y: b.y + fdy, width: b.width, height: b.height };
  });
  return unionRects(shifted);
}
