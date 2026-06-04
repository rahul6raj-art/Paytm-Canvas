import { layoutableChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import type { LayoutNode } from "@/lib/autoLayout";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

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
  const kids = layoutableChildIds(parentId, nodes, childOrder).filter((id) => id !== draggedId);

  if (mode === "horizontal") {
    let i = 0;
    for (const cid of kids) {
      const c = nodes[cid]!;
      const mid = c.x + c.width / 2;
      if (localX < mid) return i;
      i++;
    }
    return kids.length;
  }
  if (mode === "vertical") {
    let i = 0;
    for (const cid of kids) {
      const c = nodes[cid]!;
      const mid = c.y + c.height / 2;
      if (localY < mid) return i;
      i++;
    }
    return kids.length;
  }
  return 0;
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

/** World-space insertion line between siblings at `insertIndex`. */
export function computeAutoLayoutInsertIndicator(
  parentId: string,
  insertIndex: number,
  draggedId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutInsertIndicator | null {
  const parent = nodes[parentId];
  if (!parent) return null;
  const mode = parent.layoutMode ?? "none";
  if (mode !== "horizontal" && mode !== "vertical") return null;

  const layoutMap = editorNodesToLayoutMap(nodes);
  const kids = layoutableChildIds(parentId, layoutMap, childOrder).filter((id) => id !== draggedId);
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
    } else if (insertIndex <= 0) {
      const b0 = getRenderedWorldBounds(kids[0]!, nodes, childOrder);
      x = b0.x - gap / 2;
    } else if (insertIndex >= kids.length) {
      const bLast = getRenderedWorldBounds(kids[kids.length - 1]!, nodes, childOrder);
      x = bLast.x + bLast.width + gap / 2;
    } else {
      const bPrev = getRenderedWorldBounds(kids[insertIndex - 1]!, nodes, childOrder);
      const bNext = getRenderedWorldBounds(kids[insertIndex]!, nodes, childOrder);
      x = (bPrev.x + bPrev.width + bNext.x) / 2;
    }
    return {
      parentId,
      insertIndex,
      x1: x,
      y1: parentBounds.y + padTop,
      x2: x,
      y2: parentBounds.y + parentBounds.height - padBottom,
    };
  }

  let y: number;
  if (kids.length === 0) {
    y = parentBounds.y + padTop;
  } else if (insertIndex <= 0) {
    const b0 = getRenderedWorldBounds(kids[0]!, nodes, childOrder);
    y = b0.y - gap / 2;
  } else if (insertIndex >= kids.length) {
    const bLast = getRenderedWorldBounds(kids[kids.length - 1]!, nodes, childOrder);
    y = bLast.y + bLast.height + gap / 2;
  } else {
    const bPrev = getRenderedWorldBounds(kids[insertIndex - 1]!, nodes, childOrder);
    const bNext = getRenderedWorldBounds(kids[insertIndex]!, nodes, childOrder);
    y = (bPrev.y + bPrev.height + bNext.y) / 2;
  }
  return {
    parentId,
    insertIndex,
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
