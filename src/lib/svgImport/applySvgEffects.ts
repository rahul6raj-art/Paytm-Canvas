import { convertSvgPathToVector } from "@/lib/svgImport/convertSvgPathToVector";
import {
  clipDefToCombinedPathD,
  clipPathUnits,
  maskUnits,
  objectBoxPathToHostLocal,
} from "@/lib/svgImport/convertClipGeometry";
import type { DefsRegistry } from "@/lib/svgImport/resolveDefs";
import type { SvgImportDiagnostics } from "@/lib/svgImport/svgImportDiagnostics";
import { warnDiag } from "@/lib/svgImport/svgImportDiagnostics";
import { identityMatrix, type Matrix2D } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

export type PendingSvgEffect = {
  hostId: string;
  defId: string;
  kind: "clip" | "mask";
};

type EffectCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  defs: DefsRegistry;
  diag: SvgImportDiagnostics;
  seq: number;
  rootMatrix: Matrix2D;
};

function nextId(ctx: EffectCtx, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}-${ctx.seq}-${Math.random().toString(36).slice(2, 7)}`;
}

function wrapHostInClipGroup(ctx: EffectCtx, hostId: string): string {
  const host = ctx.nodes[hostId];
  if (!host?.parentId) return hostId;
  const parentId = host.parentId;
  const gid = nextId(ctx, "svg-clip-host");
  ctx.nodes[gid] = {
    id: gid,
    parentId,
    type: "group",
    name: "Clip",
    x: host.x,
    y: host.y,
    width: Math.max(1, host.width),
    height: Math.max(1, host.height),
    rotation: host.rotation ?? 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
  };
  const parentKids = ctx.childOrder[parentId] ?? [];
  ctx.childOrder[parentId] = parentKids.map((id) => (id === hostId ? gid : id));
  ctx.childOrder[gid] = [hostId];
  ctx.nodes[hostId] = {
    ...host,
    parentId: gid,
    x: 0,
    y: 0,
    rotation: 0,
  };
  return gid;
}

function finalizeMaskGroup(ctx: EffectCtx, groupId: string, maskShapeId: string): void {
  const g = ctx.nodes[groupId];
  if (!g) return;
  ctx.nodes[groupId] = { ...g, maskId: maskShapeId, clipChildren: undefined };

  const kids = (ctx.childOrder[groupId] ?? []).filter((id) => ctx.nodes[id]);
  const contentIds = kids.filter((id) => id !== maskShapeId);
  for (const cid of contentIds) {
    const n = ctx.nodes[cid];
    if (n) ctx.nodes[cid] = { ...n, maskedBy: groupId };
  }

  const maskNode = ctx.nodes[maskShapeId];
  if (maskNode) {
    ctx.nodes[maskShapeId] = {
      ...maskNode,
      isMask: true,
      fill: "#ffffff",
      fillEnabled: true,
      strokeEnabled: false,
      visible: true,
    };
  }
  ctx.childOrder[groupId] = [...contentIds, maskShapeId];
}

function createMaskPathNode(
  ctx: EffectCtx,
  groupId: string,
  pathD: string,
  name: string,
): string | null {
  const group = ctx.nodes[groupId];
  if (!group) return null;

  const localized = convertSvgPathToVector(
    pathD,
    identityMatrix(),
    identityMatrix(),
    "nonzero",
    ctx.diag.warnings,
  );
  if (!localized?.pathPoints || localized.pathPoints.length < 2) {
    warnDiag(ctx.diag, `Could not build ${name} geometry`);
    return null;
  }

  const id = nextId(ctx, "svg-mask");
  ctx.nodes[id] = {
    id,
    parentId: groupId,
    type: "path",
    name,
    x: localized.x,
    y: localized.y,
    width: localized.width,
    height: localized.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    fillEnabled: true,
    strokeEnabled: false,
    pathPoints: localized.pathPoints,
    pathClosed: localized.pathClosed ?? true,
    pathFillRule: "nonzero",
    flattenedPathData: localized.flattenedPathData,
    isMask: true,
  };
  appendChild(ctx, groupId, id);
  return id;
}

function appendChild(ctx: EffectCtx, parentId: string, childId: string): void {
  const list = ctx.childOrder[parentId] ?? [];
  if (!list.includes(childId)) ctx.childOrder[parentId] = [...list, childId];
}

function applyOneEffect(ctx: EffectCtx, effect: PendingSvgEffect): void {
  let hostId = effect.hostId;
  const host = ctx.nodes[hostId];
  if (!host) return;

  if (host.type !== "group" && host.type !== "frame") {
    hostId = wrapHostInClipGroup(ctx, hostId);
  }

  const hostNode = ctx.nodes[hostId];
  if (!hostNode) return;

  const defEl =
    effect.kind === "clip"
      ? ctx.defs.clipPaths.get(effect.defId)
      : ctx.defs.masks.get(effect.defId);
  if (!defEl) {
    warnDiag(ctx.diag, `${effect.kind} references unknown id: ${effect.defId}`);
    return;
  }

  const units =
    effect.kind === "clip" ? clipPathUnits(defEl) : maskUnits(defEl);
  let pathD = clipDefToCombinedPathD(
    defEl,
    hostNode,
    units,
    ctx.rootMatrix,
    ctx.diag.warnings,
  );
  if (!pathD) {
    warnDiag(ctx.diag, `Could not convert ${effect.kind} #${effect.defId}`);
    return;
  }

  if (units === "objectBoundingBox") {
    pathD = objectBoxPathToHostLocal(
      pathD,
      Math.max(1, hostNode.width),
      Math.max(1, hostNode.height),
    );
  }

  const maskId = createMaskPathNode(
    ctx,
    hostId,
    pathD,
    effect.kind === "clip" ? "Clip" : "Mask",
  );
  if (!maskId) return;
  finalizeMaskGroup(ctx, hostId, maskId);
}

/** Apply queued clip-path / mask references after bounds fitting. */
export function applyPendingSvgEffects(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  defs: DefsRegistry,
  diag: SvgImportDiagnostics,
  pending: PendingSvgEffect[],
  rootMatrix: Matrix2D,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  if (pending.length === 0) return { nodes, childOrder };
  const ctx: EffectCtx = {
    nodes: { ...nodes },
    childOrder: { ...childOrder },
    defs,
    diag,
    seq: 0,
    rootMatrix,
  };
  for (const effect of pending) {
    applyOneEffect(ctx, effect);
  }
  return { nodes: ctx.nodes, childOrder: ctx.childOrder };
}
