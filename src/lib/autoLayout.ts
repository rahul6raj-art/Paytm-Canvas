/**
 * Lightweight auto-layout for frame/group containers (Figma-like flex rows/columns).
 * Locked and hidden children are excluded from flow and are not repositioned.
 */

export type LayoutMode = "none" | "horizontal" | "vertical";
export type PrimaryAxisAlign = "start" | "center" | "end" | "space-between";
export type CrossAxisAlign = "start" | "center" | "end" | "stretch";
export type ConstraintHorizontal = "left" | "right" | "left-right" | "center" | "scale";
export type ConstraintVertical = "top" | "bottom" | "top-bottom" | "center" | "scale";

export interface LayoutFields {
  layoutMode?: LayoutMode;
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
}

export interface ConstraintFields {
  constraintsHorizontal?: ConstraintHorizontal;
  constraintsVertical?: ConstraintVertical;
}

export type LayoutSizingMode = "fixed" | "hug" | "fill";

export interface LayoutNode extends LayoutFields, ConstraintFields {
  id: string;
  type: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
}

export type LayoutPatch = Partial<LayoutFields>;
export type ConstraintsPatch = Partial<ConstraintFields>;

const DEF: Required<LayoutFields> = {
  layoutMode: "none",
  layoutGap: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  primaryAxisAlign: "start",
  counterAxisAlign: "start",
};

function pad(n: LayoutNode) {
  return {
    top: n.paddingTop ?? DEF.paddingTop,
    right: n.paddingRight ?? DEF.paddingRight,
    bottom: n.paddingBottom ?? DEF.paddingBottom,
    left: n.paddingLeft ?? DEF.paddingLeft,
  };
}

export function layoutableChildIds(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
): string[] {
  return (childOrder[parentId] ?? []).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
}

export function computeAutoLayoutPatches(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
): Record<string, Partial<Pick<LayoutNode, "x" | "y" | "width" | "height">>> {
  const parent = nodes[parentId];
  if (!parent || (parent.type !== "frame" && parent.type !== "group")) return {};
  const mode = parent.layoutMode ?? DEF.layoutMode;
  if (mode === "none") return {};

  const kids = layoutableChildIds(parentId, nodes, childOrder);
  if (kids.length === 0) return {};

  const p = pad(parent);
  const gap = parent.layoutGap ?? DEF.layoutGap;
  const primary = parent.primaryAxisAlign ?? DEF.primaryAxisAlign;
  const cross = parent.counterAxisAlign ?? DEF.counterAxisAlign;

  const innerW = Math.max(0, parent.width - p.left - p.right);
  const innerH = Math.max(0, parent.height - p.top - p.bottom);

  const out: Record<string, Partial<Pick<LayoutNode, "x" | "y" | "width" | "height">>> = {};

  if (mode === "horizontal") {
    const mains = kids.map((id) => Math.max(1, nodes[id]!.width));
    const crosses = kids.map((id) => Math.max(1, nodes[id]!.height));
    const sumMain = mains.reduce((a, b) => a + b, 0) + gap * Math.max(0, kids.length - 1);
    const extra = innerW - sumMain;

    let mainCursor = p.left;
    if (primary === "center") mainCursor += extra / 2;
    else if (primary === "end") mainCursor += extra;
    else if (primary === "space-between" && kids.length === 1) {
      mainCursor += extra / 2;
    }

    const between =
      primary === "space-between" && kids.length > 1 ? extra / (kids.length - 1) : 0;

    const fillCount = kids.filter((id) => nodes[id]!.layoutSizingHorizontal === "fill").length;
    const fixedMain = kids.reduce((sum, id, i) => {
      return nodes[id]!.layoutSizingHorizontal === "fill" ? sum : sum + mains[i]!;
    }, 0);
    const fillExtra =
      fillCount > 0 ? Math.max(0, innerW - fixedMain - gap * Math.max(0, kids.length - 1)) : 0;
    const fillW = fillCount > 0 ? fillExtra / fillCount : 0;

    for (let i = 0; i < kids.length; i++) {
      const id = kids[i]!;
      const child = nodes[id]!;
      const w0 = mains[i]!;
      const h0 = crosses[i]!;
      const x = mainCursor;
      let y = p.top;
      let h = h0;
      const cw = child.layoutSizingHorizontal === "fill" ? Math.max(1, fillW) : w0;

      const childCross =
        child.layoutSizingVertical === "fill" ? "stretch" : cross;
      if (childCross === "stretch") {
        h = innerH;
        y = p.top;
      } else if (childCross === "center") {
        y = p.top + (innerH - h0) / 2;
      } else if (childCross === "end") {
        y = p.top + innerH - h0;
      }

      out[id] = { x, y, width: cw, height: h };

      mainCursor += cw + gap + between;
    }
  } else {
    const mains = kids.map((id) => Math.max(1, nodes[id]!.height));
    const crosses = kids.map((id) => Math.max(1, nodes[id]!.width));
    const sumMain = mains.reduce((a, b) => a + b, 0) + gap * Math.max(0, kids.length - 1);
    const extra = innerH - sumMain;

    let mainCursor = p.top;
    if (primary === "center") mainCursor += extra / 2;
    else if (primary === "end") mainCursor += extra;
    else if (primary === "space-between" && kids.length === 1) {
      mainCursor += extra / 2;
    }

    const between =
      primary === "space-between" && kids.length > 1 ? extra / (kids.length - 1) : 0;

    const fillCount = kids.filter((id) => nodes[id]!.layoutSizingVertical === "fill").length;
    const fixedMain = kids.reduce((sum, id, i) => {
      return nodes[id]!.layoutSizingVertical === "fill" ? sum : sum + mains[i]!;
    }, 0);
    const fillExtra =
      fillCount > 0 ? Math.max(0, innerH - fixedMain - gap * Math.max(0, kids.length - 1)) : 0;
    const fillH = fillCount > 0 ? fillExtra / fillCount : 0;

    for (let i = 0; i < kids.length; i++) {
      const id = kids[i]!;
      const child = nodes[id]!;
      const h0 = mains[i]!;
      const w0 = crosses[i]!;
      const y = mainCursor;
      let x = p.left;
      let w = w0;
      const ch = child.layoutSizingVertical === "fill" ? Math.max(1, fillH) : h0;

      const childCross =
        child.layoutSizingHorizontal === "fill" ? "stretch" : cross;
      if (childCross === "stretch") {
        w = innerW;
        x = p.left;
      } else if (childCross === "center") {
        x = p.left + (innerW - w0) / 2;
      } else if (childCross === "end") {
        x = p.left + innerW - w0;
      }

      out[id] = { x, y, width: w, height: ch };

      mainCursor += ch + gap + between;
    }
  }

  return out;
}

export function constraintResizeChildPatches(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): Record<string, Partial<Pick<LayoutNode, "x" | "y" | "width" | "height">>> {
  const parent = nodes[parentId];
  if (!parent || (parent.type !== "frame" && parent.type !== "group")) return {};
  if ((parent.layoutMode ?? "none") !== "none") return {};

  const dw = newW - oldW;
  const dh = newH - oldH;
  if (dw === 0 && dh === 0) return {};

  const out: Record<string, Partial<Pick<LayoutNode, "x" | "y" | "width" | "height">>> = {};
  const kids = (childOrder[parentId] ?? []).filter((id) => {
    const c = nodes[id];
    return c && c.visible && !c.locked;
  });

  for (const id of kids) {
    const c = nodes[id]!;
    const ch = c.constraintsHorizontal ?? "left";
    const cv = c.constraintsVertical ?? "top";
    let { x, y, width, height } = c;

    switch (ch) {
      case "left":
        break;
      case "right":
        x += dw;
        break;
      case "left-right":
        width = Math.max(1, width + dw);
        break;
      case "center":
        x += dw / 2;
        break;
      case "scale": {
        const sx = oldW > 0 ? newW / oldW : 1;
        x *= sx;
        width = Math.max(1, width * sx);
        break;
      }
      default:
        break;
    }

    switch (cv) {
      case "top":
        break;
      case "bottom":
        y += dh;
        break;
      case "top-bottom":
        height = Math.max(1, height + dh);
        break;
      case "center":
        y += dh / 2;
        break;
      case "scale": {
        const sy = oldH > 0 ? newH / oldH : 1;
        y *= sy;
        height = Math.max(1, height * sy);
        break;
      }
      default:
        break;
    }

    out[id] = { x, y, width, height };
  }

  return out;
}

/** Apply auto-layout to a parent and all nested auto-layout containers (post-import / bulk relayout). */
export function applyDeepAutoLayout(
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, LayoutNode> {
  let next = { ...nodes };
  const patches = computeAutoLayoutPatches(parentId, next, childOrder);
  if (Object.keys(patches).length > 0) {
    for (const [cid, p] of Object.entries(patches)) {
      const cn = next[cid];
      if (!cn || cn.locked) continue;
      next[cid] = { ...cn, ...p };
    }
  }
  const parent = next[parentId];
  if (!parent || (parent.layoutMode ?? "none") === "none") return next;
  for (const cid of childOrder[parentId] ?? []) {
    const c = next[cid];
    if (c && (c.type === "frame" || c.type === "group") && (c.layoutMode ?? "none") !== "none") {
      next = applyDeepAutoLayout(next, childOrder, cid);
    }
  }
  return next;
}

/** Relayout every auto-layout container on the page (e.g. after Figma import). */
export function applyDeepAutoLayoutAll(
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
): Record<string, LayoutNode> {
  let next = { ...nodes };
  for (const id of Object.keys(next)) {
    const n = next[id];
    if (!n || (n.type !== "frame" && n.type !== "group")) continue;
    if ((n.layoutMode ?? "none") === "none") continue;
    next = applyDeepAutoLayout(next, childOrder, id);
  }
  return next;
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
