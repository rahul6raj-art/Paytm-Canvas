/**
 * Figma-like auto layout — public API for the editor.
 * Core engine lives in `@/lib/layoutEngine` (rendering-independent).
 */

export type {
  LayoutMode,
  PrimaryAxisAlign,
  CrossAxisAlign,
  LayoutSizingMode,
  LayoutPositioning,
} from "@/lib/layoutEngine/types";

import type {
  LayoutMode,
  PrimaryAxisAlign,
  CrossAxisAlign,
  LayoutSizingMode,
  LayoutPositioning,
} from "@/lib/layoutEngine/types";

import {
  layoutAutoNode,
  layoutAutoNodeDeep,
  layoutableChildIds,
  sortIdsForAutoLayoutFlow,
} from "@/lib/layoutEngine/layoutAutoNode";
import { relayoutDirtyTree, markLayoutDirty } from "@/lib/layoutEngine/dirty";
import {
  parentPrimaryAxisHug,
  type LayoutEngineNode,
} from "@/lib/layoutEngine/types";

export interface LayoutFields {
  layoutMode?: LayoutMode;
  layoutGap?: number;
  layoutGapAuto?: boolean;
  layoutWrap?: boolean;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
}

export type ConstraintHorizontal = "left" | "right" | "left-right" | "center" | "scale";
export type ConstraintVertical = "top" | "bottom" | "top-bottom" | "center" | "scale";

export interface ConstraintFields {
  constraintsHorizontal?: ConstraintHorizontal;
  constraintsVertical?: ConstraintVertical;
}

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
  layoutPositioning?: LayoutPositioning;
  layoutGrow?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  computedWidth?: number;
  computedHeight?: number;
  layoutDirty?: boolean;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textResizeMode?: "auto-width" | "auto-height" | "fixed";
}

export type LayoutPatch = Partial<LayoutFields>;
export type ConstraintsPatch = Partial<ConstraintFields>;

export type AutoLayoutComputeResult = {
  children: Record<string, Partial<Pick<LayoutNode, "x" | "y" | "width" | "height" | "computedWidth" | "computedHeight" | "layoutDirty">>>;
  parent?: Partial<Pick<LayoutNode, "width" | "height" | "computedWidth" | "computedHeight" | "layoutDirty">>;
};

export { layoutableChildIds, sortIdsForAutoLayoutFlow, markLayoutDirty, relayoutDirtyTree };

export {
  parentPrimaryAxisHug,
  parentCounterAxisHug,
} from "@/lib/layoutEngine/types";

export { measureNode, resolveHugSize, resolveFillSize } from "@/lib/layoutEngine";

/** Guess horizontal vs vertical flow from child arrangement (Figma infers direction). */
export function inferAutoLayoutFlow(
  nodes: Record<string, LayoutNode>,
  childIds: string[],
): Exclude<LayoutMode, "none"> {
  if (childIds.length < 2) return "horizontal";

  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCy = Infinity;
  let maxCy = -Infinity;

  for (const id of childIds) {
    const n = nodes[id];
    if (!n) continue;
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    minCx = Math.min(minCx, cx);
    maxCx = Math.max(maxCx, cx);
    minCy = Math.min(minCy, cy);
    maxCy = Math.max(maxCy, cy);
  }

  const spreadX = maxCx - minCx;
  const spreadY = maxCy - minCy;
  return spreadX >= spreadY ? "horizontal" : "vertical";
}

export function computeAutoLayout(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutComputeResult {
  return layoutAutoNode(parentId, nodes as Record<string, LayoutEngineNode>, childOrder);
}

export function computeAutoLayoutPatches(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
): Record<string, Partial<Pick<LayoutNode, "x" | "y" | "width" | "height">>> {
  return computeAutoLayout(parentId, nodes, childOrder).children;
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

export function applyDeepAutoLayout(
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, LayoutNode> {
  return layoutAutoNodeDeep(nodes as Record<string, LayoutEngineNode>, childOrder, parentId) as Record<
    string,
    LayoutNode
  >;
}

function patchTouchesGap(patch: LayoutPatch): boolean {
  return "layoutGap" in patch || "layoutGapAuto" in patch;
}

/**
 * After gap changes on a fixed-size auto-layout frame, resize the primary axis to fit
 * children + gap + padding (padding-only edits keep the frame size fixed).
 */
export function applyGapResponsivePrimarySize(
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): Record<string, LayoutNode> {
  const parent = nodes[containerId];
  if (!parent || (parent.layoutMode ?? "none") === "none") return nodes;

  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  if (parentPrimaryAxisHug(parent)) {
    return applyDeepAutoLayout(nodes, childOrder, containerId);
  }

  let next = applyDeepAutoLayout(nodes, childOrder, containerId);
  const laid = next[containerId];
  if (!laid) return next;

  const sizePatch: Partial<LayoutNode> = {};
  if (mode === "horizontal") {
    const targetW = laid.computedWidth ?? laid.width;
    if (Math.abs(targetW - laid.width) > 0.01) sizePatch.width = targetW;
  } else {
    const targetH = laid.computedHeight ?? laid.height;
    if (Math.abs(targetH - laid.height) > 0.01) sizePatch.height = targetH;
  }
  if (Object.keys(sizePatch).length === 0) return next;

  next = { ...next, [containerId]: { ...laid, ...sizePatch } };
  return applyDeepAutoLayout(next, childOrder, containerId);
}

export function applyLayoutPatchWithAutoLayout(
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
  patch: LayoutPatch,
): Record<string, LayoutNode> {
  const parent = nodes[containerId];
  if (!parent) return nodes;
  const merged = { ...nodes, [containerId]: { ...parent, ...patch } };
  if (patchTouchesGap(patch)) {
    return applyGapResponsivePrimarySize(merged, childOrder, containerId);
  }
  return applyDeepAutoLayout(merged, childOrder, containerId);
}

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

export { insertIndexInAutoLayout, reorderChildByPointer } from "@/lib/autoLayoutReorder";

export { inferAutoLayoutGap } from "@/lib/layoutEngine/inferGap";

export function inferAutoLayoutPadding(
  nodes: Record<string, LayoutNode>,
  childIds: string[],
  frameW: number,
  frameH: number,
): Pick<LayoutFields, "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"> {
  if (childIds.length === 0) {
    return { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of childIds) {
    const n = nodes[id]!;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return {
    paddingLeft: Math.max(0, Math.round(minX)),
    paddingTop: Math.max(0, Math.round(minY)),
    paddingRight: Math.max(0, Math.round(frameW - maxX)),
    paddingBottom: Math.max(0, Math.round(frameH - maxY)),
  };
}

/** Default sizing when auto layout is added — hug content so the frame grows/shrinks with children. */
export function defaultHugSizingForContainer(
  _mode: Exclude<LayoutMode, "none">,
): Pick<LayoutNode, "layoutSizingHorizontal" | "layoutSizingVertical"> {
  return { layoutSizingHorizontal: "hug", layoutSizingVertical: "hug" };
}

// ——— Spec-aligned aliases (recursive layout engine public API) ———

export {
  measureNode as measureAutoLayoutNode,
  measureNode as resolveChildSize,
  layoutAutoNode as layoutAutoLayoutNode,
  layoutAutoNodeDeep as layoutAutoLayoutNodeDeep,
  resolveHugSize as calculateHugSize,
} from "@/lib/layoutEngine";
export {
  layoutChildren as layoutHorizontal,
  layoutChildren as layoutVertical,
  buildFlowLines as layoutWrapped,
} from "@/lib/layoutEngine/layoutChildren";
export { resolveFillSizesByGrow as calculateFillSpace } from "@/lib/layoutEngine/sizing";
export { editorNodesToLayoutMap } from "@/lib/autoLayoutReorder";

/** Apply primary/counter alignment when positioning (delegates to full layout pass). */
export function applyAlignment(
  parentId: string,
  nodes: Record<string, LayoutNode>,
  childOrder: Record<string, string[]>,
): AutoLayoutComputeResult {
  return computeAutoLayout(parentId, nodes, childOrder);
}
