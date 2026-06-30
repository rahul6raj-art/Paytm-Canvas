import { flowChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import type { LayoutEngineNode, LayoutMode } from "@/lib/layoutEngine/types";
import type { LayoutNode } from "@/lib/autoLayout";
import {
  buildParentMapFromChildOrder,
  getRenderedWorldBounds,
  isAncestorOf,
  worldPointToParentLocalFromChildOrder,
} from "@/lib/editorGraph";
import { pickDeepestFrameOrGroupAtWorldPoint } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";

/** Map a flow-order insert index to an index in the parent's full child list. */
export function flowInsertIndexToChildOrderIndex(
  parentId: string,
  flowInsertIndex: number,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  mode: Exclude<LayoutMode, "none">,
  excludeId?: string,
): number {
  const fullList = childOrder[parentId] ?? [];
  const flowKids = flowChildIds(
    parentId,
    nodes as Record<string, LayoutEngineNode>,
    childOrder,
  ).filter((id) => id !== excludeId);

  if (flowKids.length === 0) return fullList.length;

  if (flowInsertIndex >= flowKids.length) {
    const lastId = flowKids[flowKids.length - 1]!;
    const lastIdx = fullList.indexOf(lastId);
    return lastIdx < 0 ? fullList.length : lastIdx + 1;
  }

  const beforeId = flowKids[flowInsertIndex]!;
  const fullIdx = fullList.indexOf(beforeId);
  return fullIdx < 0 ? flowInsertIndex : fullIdx;
}

/** Insert index along visual flow order (0 = before first sibling, length = after last). */
export function flowInsertIndexFromPointer(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  localX: number,
  localY: number,
  draggedId: string,
): number {
  const parent = nodes[parentId];
  if (!parent) return 0;
  const mode = parent.layoutMode ?? "none";
  if (mode !== "horizontal" && mode !== "vertical") return 0;

  const flowKids = flowChildIds(
    parentId,
    nodes as Record<string, LayoutEngineNode>,
    childOrder,
  ).filter((id) => id !== draggedId);

  let flowInsert = 0;
  if (mode === "horizontal") {
    for (const cid of flowKids) {
      const c = nodes[cid]!;
      const mid = c.x + c.width / 2;
      if (localX < mid) break;
      flowInsert++;
    }
  } else {
    for (const cid of flowKids) {
      const c = nodes[cid]!;
      const mid = c.y + c.height / 2;
      if (localY < mid) break;
      flowInsert++;
    }
  }

  return flowInsert;
}

export function insertIndexInAutoLayout(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  localX: number,
  localY: number,
  draggedId: string,
): number {
  const parent = nodes[parentId];
  if (!parent) return 0;
  const mode = parent.layoutMode ?? "none";
  if (mode !== "horizontal" && mode !== "vertical") return 0;

  const flowInsert = flowInsertIndexFromPointer(
    parentId,
    nodes,
    childOrder,
    localX,
    localY,
    draggedId,
  );

  return flowInsertIndexToChildOrderIndex(
    parentId,
    flowInsert,
    nodes,
    childOrder,
    mode,
    draggedId,
  );
}

export type AutoLayoutReorderContext = {
  parentId: string;
  draggedId: string;
  mode: "horizontal" | "vertical";
};

/** Single flow child inside an auto-layout parent — use in-flow reorder instead of detach. */
export function getAutoLayoutReorderContext(
  nodeIds: string[],
  nodes: Record<string, Pick<EditorNode, "parentId" | "layoutPositioning" | "locked" | "visible">>,
  parents: Record<string, Pick<EditorNode, "layoutMode" | "type">>,
): AutoLayoutReorderContext | null {
  if (nodeIds.length !== 1) return null;
  const draggedId = nodeIds[0]!;
  const n = nodes[draggedId];
  if (!n?.parentId || n.locked || !n.visible) return null;
  if ((n.layoutPositioning ?? "auto") === "absolute") return null;
  const parent = parents[n.parentId];
  if (!parent || (parent.type !== "frame" && parent.type !== "group")) return null;
  const mode = parent.layoutMode ?? "none";
  if (mode !== "horizontal" && mode !== "vertical") return null;
  return { parentId: n.parentId, draggedId, mode };
}

export function reorderChildByPointer(
  ctx: AutoLayoutReorderContext,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  localX: number,
  localY: number,
): number {
  return insertIndexInAutoLayout(
    ctx.parentId,
    nodes,
    childOrder,
    localX,
    localY,
    ctx.draggedId,
  );
}

export type AutoLayoutInsertIndicator = {
  parentId: string;
  insertIndex: number;
  /** World-space line segment for the insertion marker. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function editorNodesToLayoutMap(nodes: Record<string, EditorNode>): Record<string, LayoutNode> {
  const m: Record<string, LayoutNode> = {};
  for (const id of Object.keys(nodes)) {
    const n = nodes[id]!;
    m[id] = {
      id: n.id,
      type: n.type,
      parentId: n.parentId,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      visible: n.visible,
      locked: n.locked,
      layoutMode: n.layoutMode,
      layoutGap: n.layoutGap,
      paddingTop: n.paddingTop,
      paddingRight: n.paddingRight,
      paddingBottom: n.paddingBottom,
      paddingLeft: n.paddingLeft,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
    };
  }
  return m;
}

/** World-space insertion line between flow siblings at `flowInsertIndex`. */
export function computeAutoLayoutInsertIndicator(
  parentId: string,
  flowInsertIndex: number,
  draggedId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutInsertIndicator | null {
  const parent = nodes[parentId];
  if (!parent) return null;
  const mode = parent.layoutMode ?? "none";
  if (mode !== "horizontal" && mode !== "vertical") return null;

  const layoutMap = editorNodesToLayoutMap(nodes);
  const kids = flowChildIds(
    parentId,
    layoutMap as Record<string, LayoutEngineNode>,
    childOrder,
  ).filter((id) => id !== draggedId);
  const parentBounds = getRenderedWorldBounds(parentId, nodes, childOrder);
  const gap = parent.layoutGap ?? 0;
  const padTop = parent.paddingTop ?? 0;
  const padBottom = parent.paddingBottom ?? 0;
  const padLeft = parent.paddingLeft ?? 0;
  const padRight = parent.paddingRight ?? 0;

  if (mode === "horizontal") {
    let x: number;
    if (kids.length === 0) {
      x = parentBounds.x + padLeft;
    } else if (flowInsertIndex <= 0) {
      const b0 = getRenderedWorldBounds(kids[0]!, nodes, childOrder);
      x = b0.x - gap / 2;
    } else if (flowInsertIndex >= kids.length) {
      const bLast = getRenderedWorldBounds(kids[kids.length - 1]!, nodes, childOrder);
      x = bLast.x + bLast.width + gap / 2;
    } else {
      const bPrev = getRenderedWorldBounds(kids[flowInsertIndex - 1]!, nodes, childOrder);
      const bNext = getRenderedWorldBounds(kids[flowInsertIndex]!, nodes, childOrder);
      x = (bPrev.x + bPrev.width + bNext.x) / 2;
    }
    return {
      parentId,
      insertIndex: flowInsertIndex,
      x1: x,
      y1: parentBounds.y + padTop,
      x2: x,
      y2: parentBounds.y + parentBounds.height - padBottom,
    };
  }

  let y: number;
  if (kids.length === 0) {
    y = parentBounds.y + padTop;
  } else if (flowInsertIndex <= 0) {
    const b0 = getRenderedWorldBounds(kids[0]!, nodes, childOrder);
    y = b0.y - gap / 2;
  } else if (flowInsertIndex >= kids.length) {
    const bLast = getRenderedWorldBounds(kids[kids.length - 1]!, nodes, childOrder);
    y = bLast.y + bLast.height + gap / 2;
  } else {
    const bPrev = getRenderedWorldBounds(kids[flowInsertIndex - 1]!, nodes, childOrder);
    const bNext = getRenderedWorldBounds(kids[flowInsertIndex]!, nodes, childOrder);
    y = (bPrev.y + bPrev.height + bNext.y) / 2;
  }
  return {
    parentId,
    insertIndex: flowInsertIndex,
    x1: parentBounds.x + padLeft,
    y1: y,
    x2: parentBounds.x + parentBounds.width - padRight,
    y2: y,
  };
}

export function pointerInsideAutoLayoutContent(
  parentId: string,
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const parent = nodes[parentId];
  if (!parent) return false;
  const b = getRenderedWorldBounds(parentId, nodes, childOrder);
  const padLeft = parent.paddingLeft ?? 0;
  const padRight = parent.paddingRight ?? 0;
  const padTop = parent.paddingTop ?? 0;
  const padBottom = parent.paddingBottom ?? 0;
  return (
    worldX >= b.x + padLeft &&
    worldX <= b.x + b.width - padRight &&
    worldY >= b.y + padTop &&
    worldY <= b.y + b.height - padBottom
  );
}

export function isAutoLayoutContainer(
  n: Pick<EditorNode, "layoutMode" | "type" | "locked" | "visible"> | undefined,
): boolean {
  if (!n || n.locked || !n.visible) return false;
  if (n.type !== "frame" && n.type !== "group") return false;
  const mode = n.layoutMode ?? "none";
  return mode === "horizontal" || mode === "vertical";
}

export type AutoLayoutDropTarget = {
  parentId: string;
  insertIndex: number;
  flowInsertIndex: number;
};

/** Deepest auto-layout frame/group under the pointer and flow insert index for a dropped node. */
export function resolveAutoLayoutDropTarget(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  draggedId: string,
  excludeSubtreeOf?: string | null,
): AutoLayoutDropTarget | null {
  const hit = pickDeepestFrameOrGroupAtWorldPoint(worldX, worldY, nodes, childOrder, {
    excludeDescendantsOf: excludeSubtreeOf ?? null,
  });
  if (!hit) return null;

  const parentOf = buildParentMapFromChildOrder(childOrder);
  let cur: string | null = hit;
  while (cur) {
    const n: EditorNode | undefined = nodes[cur];
    if (
      isAutoLayoutContainer(n) &&
      pointerInsideAutoLayoutContent(cur, worldX, worldY, nodes, childOrder)
    ) {
      if (
        excludeSubtreeOf &&
        (cur === excludeSubtreeOf || isAncestorOf(nodes, excludeSubtreeOf, cur))
      ) {
        return null;
      }
      const local = worldPointToParentLocalFromChildOrder(
        worldX,
        worldY,
        cur,
        nodes,
        childOrder,
      );
      const layoutMap = editorNodesToLayoutMap(nodes);
      const flowInsert = flowInsertIndexFromPointer(
        cur,
        layoutMap,
        childOrder,
        local.x,
        local.y,
        draggedId,
      );
      const insertIndex = insertIndexInAutoLayout(
        cur,
        layoutMap,
        childOrder,
        local.x,
        local.y,
        draggedId,
      );
      return { parentId: cur, insertIndex, flowInsertIndex: flowInsert };
    }
    cur = parentOf.get(cur) ?? null;
  }
  return null;
}
