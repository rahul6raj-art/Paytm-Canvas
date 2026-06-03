import type { FigDocument, FigNode } from "openfig-core";
import { nodeId } from "openfig-core";
import type { BooleanOperation } from "@/lib/booleanGeometry";
import { BOOLEAN_OPERATION_LABELS } from "@/lib/booleanGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

export type FigMaskType = "OUTLINE" | "LUMINANCE" | string;

type ImportCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  idMap: Map<string, string>;
  seq: number;
};

function paytmId(ctx: ImportCtx, figKey: string): string {
  const hit = ctx.idMap.get(figKey);
  if (hit) return hit;
  return `fig-${figKey.replace(/:/g, "-")}`;
}

function nextId(ctx: ImportCtx, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}-${ctx.seq}`;
}

function boundsFromChildren(ids: string[], nodes: Record<string, EditorNode>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const n = nodes[id];
    if (!n) continue;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function mapFigBooleanOperation(raw: string | undefined): BooleanOperation {
  switch (raw) {
    case "SUBTRACT":
      return "subtract";
    case "INTERSECT":
      return "intersect";
    case "XOR":
    case "EXCLUDE":
      return "exclude";
    case "UNION":
    default:
      return "union";
  }
}

/** Figma frame clip (children clipped to frame bounds). */
export function frameClipChildrenFromFig(node: FigNode): boolean {
  return node.frameMaskDisabled !== true;
}

const FIG_CLIP_CONTAINER_TYPES = new Set([
  "FRAME",
  "INSTANCE",
  "COMPONENT",
  "COMPONENT_SET",
  "SYMBOL",
]);

/** Whether a Figma node should set `clipChildren` on the imported editor node. */
export function figContainerClipChildren(node: FigNode): boolean | undefined {
  if (!FIG_CLIP_CONTAINER_TYPES.has(node.type)) return undefined;
  return frameClipChildrenFromFig(node);
}

function convertParentToMaskGroup(
  groupId: string,
  maskId: string,
  contentIds: string[],
  maskType: FigMaskType | undefined,
  ctx: ImportCtx,
): void {
  const g = ctx.nodes[groupId];
  if (!g) return;

  g.type = "group";
  g.maskId = maskId;
  if (maskType) g.figMaskType = maskType;

  const maskNode = ctx.nodes[maskId];
  if (maskNode) {
    maskNode.isMask = true;
    if (maskType) maskNode.figMaskType = maskType;
  }

  for (const cid of contentIds) {
    const n = ctx.nodes[cid];
    if (n) n.maskedBy = groupId;
  }

  const masked = new Set([maskId, ...contentIds]);
  const order = ctx.childOrder[groupId] ?? [];
  const rest = order.filter((id) => !masked.has(id));
  ctx.childOrder[groupId] = [...rest, ...contentIds, maskId];
}

function createNestedMaskGroup(
  parentId: string,
  maskId: string,
  contentIds: string[],
  maskType: FigMaskType | undefined,
  ctx: ImportCtx,
): void {
  const allIds = [...contentIds, maskId];
  const bounds = boundsFromChildren(allIds, ctx.nodes);
  const gid = nextId(ctx, "group-mask");

  ctx.nodes[gid] = {
    id: gid,
    parentId,
    type: "group",
    name: "Mask group",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    maskId,
    figMaskType: maskType,
  };

  for (const cid of contentIds) {
    const n = ctx.nodes[cid];
    if (!n) continue;
    ctx.nodes[cid] = {
      ...n,
      parentId: gid,
      x: n.x - bounds.x,
      y: n.y - bounds.y,
      maskedBy: gid,
    };
  }

  const m = ctx.nodes[maskId];
  if (m) {
    ctx.nodes[maskId] = {
      ...m,
      parentId: gid,
      x: m.x - bounds.x,
      y: m.y - bounds.y,
      isMask: true,
      figMaskType: maskType,
      maskedBy: undefined,
    };
  }

  ctx.childOrder[gid] = [...contentIds, maskId];

  const order = [...(ctx.childOrder[parentId] ?? [])];
  const remove = new Set(allIds);
  const insertIdx = order.findIndex((id) => remove.has(id));
  const newOrder = order.filter((id) => !remove.has(id));
  newOrder.splice(insertIdx >= 0 ? insertIdx : newOrder.length, 0, gid);
  ctx.childOrder[parentId] = newOrder;
}

/**
 * After children are imported: apply Figma mask groups and frame clip flags.
 * Figma masks clip siblings above the mask layer in paint order (childrenMap is back-to-front).
 */
export function finalizeFigContainer(
  figKey: string,
  paytmParentId: string,
  doc: FigDocument,
  ctx: ImportCtx,
  isImportable: (node: FigNode) => boolean,
): void {
  const parent = ctx.nodes[paytmParentId];
  if (!parent) return;

  const figNode = doc.nodeMap.get(figKey);
  if (figNode) {
    const clip = figContainerClipChildren(figNode);
    if (clip !== undefined && (parent.type === "frame" || parent.type === "group")) {
      parent.clipChildren = clip;
    }
  }

  if (parent.isBooleanGroup) return;

  const figKids = (doc.childrenMap.get(figKey) ?? []).filter((k) => k.phase !== "REMOVED");
  const maskIdx = figKids.findIndex((k) => k.mask === true);
  if (maskIdx < 0) return;

  const maskFig = figKids[maskIdx]!;
  const maskKey = nodeId(maskFig);
  if (!maskKey) return;
  const maskId = paytmId(ctx, maskKey);
  if (!ctx.nodes[maskId]) return;

  const maskType = maskFig.maskType as FigMaskType | undefined;

  const contentIds = figKids
    .slice(maskIdx + 1)
    .filter(isImportable)
    .map((f) => {
      const key = nodeId(f);
      return key ? paytmId(ctx, key) : "";
    })
    .filter((id) => id && ctx.nodes[id]);

  if (contentIds.length === 0) return;

  const belowIds = figKids
    .slice(0, maskIdx)
    .filter(isImportable)
    .map((f) => {
      const key = nodeId(f);
      return key ? paytmId(ctx, key) : "";
    })
    .filter((id) => id && ctx.nodes[id]);

  if (belowIds.length === 0) {
    convertParentToMaskGroup(paytmParentId, maskId, contentIds, maskType, ctx);
  } else {
    createNestedMaskGroup(paytmParentId, maskId, contentIds, maskType, ctx);
  }
}

export function applyFigBooleanToNode(node: FigNode, base: EditorNode): void {
  if (node.type !== "BOOLEAN_OPERATION") return;
  const op = mapFigBooleanOperation(node.booleanOperation);
  base.type = "group";
  base.isBooleanGroup = true;
  base.booleanOperation = op;
  base.name = node.name || BOOLEAN_OPERATION_LABELS[op];
}
