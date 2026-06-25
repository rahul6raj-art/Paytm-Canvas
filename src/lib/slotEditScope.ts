import { isAncestorOf } from "@/lib/editorGraph";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  findSlotContainerInInstance,
  slotTargetPath,
  snapshotContentSignature,
} from "@/lib/components/componentSlots";
import type { ComponentPropertyDef, SlotContentSnapshot } from "@/lib/components/types";
import { resolveVariantMasterId } from "@/lib/components/resolveInstance";
import type { EditorNode } from "@/stores/useEditorStore";
import { worldRect } from "@/lib/tree";

export type SlotEditBreadcrumbCrumb = {
  label: string;
  instanceRootId: string;
  propertyKey: string;
  containerId: string;
};

export type ActiveSlotEditState = {
  instanceRootId: string;
  propertyKey: string;
  containerId: string;
  baselineSignature: string;
  breadcrumb: SlotEditBreadcrumbCrumb[];
};

export type ResolvedSlotEditScope = {
  instanceRootId: string;
  propertyKey: string;
  containerId: string;
  def: ComponentPropertyDef;
  masterId: string;
  label: string;
};

export function slotDefsForInstance(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
): ComponentPropertyDef[] {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return [];
  const masterId = resolveVariantMasterId(
    nodes,
    root.variantGroupId ?? "",
    root.selectedVariantProperties,
    root.sourceComponentId,
  );
  const master = nodes[masterId];
  return (master?.componentPropertyDefs ?? []).filter((d) => d?.kind === "slot");
}

export function resolveSlotEditScope(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  propertyKey: string,
): ResolvedSlotEditScope | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const masterId = resolveVariantMasterId(
    nodes,
    root.variantGroupId ?? "",
    root.selectedVariantProperties,
    root.sourceComponentId,
  );
  const master = nodes[masterId];
  const def = master?.componentPropertyDefs?.find((d) => d.key === propertyKey && d.kind === "slot");
  if (!def) return null;
  const containerId = findSlotContainerInInstance(
    nodes,
    root,
    instanceRootId,
    slotTargetPath(def),
  );
  if (!containerId) return null;
  return {
    instanceRootId,
    propertyKey,
    containerId,
    def,
    masterId,
    label: def.label,
  };
}

/** Find the slot property whose container was hit (deepest matching slot). */
export function findSlotPropertyForHit(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  hitId: string,
): ResolvedSlotEditScope | null {
  const instRoot = findInstanceRoot(nodes, hitId);
  if (!instRoot) return null;
  let best: ResolvedSlotEditScope | null = null;
  let bestDepth = -1;

  for (const def of slotDefsForInstance(nodes, instRoot)) {
    const scope = resolveSlotEditScope(nodes, childOrder, instRoot, def.key);
    if (!scope) continue;
    if (hitId === scope.containerId || isAncestorOf(nodes, scope.containerId, hitId)) {
      const depth = pathDepth(nodes, instRoot, hitId);
      if (depth > bestDepth) {
        best = scope;
        bestDepth = depth;
      }
    }
  }
  return best;
}

function pathDepth(
  nodes: Record<string, EditorNode>,
  rootId: string,
  nodeId: string,
): number {
  let depth = 0;
  let cur: string | null = nodeId;
  while (cur && cur !== rootId) {
    depth++;
    cur = nodes[cur]?.parentId ?? null;
  }
  return depth;
}

export function isInsideSlotContainer(
  nodes: Record<string, EditorNode>,
  containerId: string,
  nodeId: string,
): boolean {
  return nodeId === containerId || isAncestorOf(nodes, containerId, nodeId);
}

/** True when node is part of the instance but outside the active slot container subtree. */
export function isSlotShellLayer(
  nodes: Record<string, EditorNode>,
  active: ActiveSlotEditState | null,
  nodeId: string,
): boolean {
  if (!active) return false;
  if (isInsideSlotContainer(nodes, active.containerId, nodeId)) return false;
  return (
    nodeId === active.instanceRootId ||
    isAncestorOf(nodes, active.instanceRootId, nodeId)
  );
}

export function shouldBlockSlotShellSelection(
  nodes: Record<string, EditorNode>,
  active: ActiveSlotEditState | null,
  hitId: string,
): boolean {
  return isSlotShellLayer(nodes, active, hitId);
}

export function slotSelectionTargetForClick(
  hitId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  active: ActiveSlotEditState | null,
  objectEditModeNodeId: string | null,
  deepSelect: boolean,
): string {
  if (!active) {
    return hitId;
  }
  if (isInsideSlotContainer(nodes, active.containerId, hitId)) {
    return hitId;
  }
  if (hitId === active.instanceRootId) return active.instanceRootId;
  return active.containerId;
}

export function slotDrillTargetForDoubleClick(
  hitId: string,
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  active: ActiveSlotEditState | null,
  pickDeepestAt: (x: number, y: number) => string | null,
): { scope: ResolvedSlotEditScope; selectId: string } | null {
  const deepest = pickDeepestAt(worldX, worldY) ?? hitId;
  if (!deepest) return null;

  if (active) {
    if (isInsideSlotContainer(nodes, active.containerId, deepest)) {
      const nestedInst = findInstanceRoot(nodes, deepest);
      if (nestedInst && nestedInst !== active.instanceRootId) {
        const nestedSlot = findSlotPropertyForHit(nodes, childOrder, deepest);
        if (nestedSlot && nestedSlot.containerId !== active.containerId) {
          return { scope: nestedSlot, selectId: deepest };
        }
      }
      return null;
    }
    return null;
  }

  const slot = findSlotPropertyForHit(nodes, childOrder, deepest);
  if (!slot) return null;
  return { scope: slot, selectId: deepest };
}

export function slotContentChanged(
  baselineSignature: string,
  current: SlotContentSnapshot | null,
): boolean {
  if (!current) return false;
  return snapshotContentSignature(current) !== baselineSignature;
}

export function isDeletableDuringSlotEdit(
  nodes: Record<string, EditorNode>,
  active: ActiveSlotEditState | null,
  nodeId: string,
): boolean {
  if (!active) return true;
  if (isSlotShellLayer(nodes, active, nodeId)) return false;
  if (nodeId === active.instanceRootId) return false;
  return isInsideSlotContainer(nodes, active.containerId, nodeId);
}

export function findSlotPropertyAtWorldPoint(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  worldX: number,
  worldY: number,
  pickDeepestAt: (x: number, y: number) => string | null,
): ResolvedSlotEditScope | null {
  const hit = pickDeepestAt(worldX, worldY);
  if (!hit) return null;
  return findSlotPropertyForHit(nodes, childOrder, hit);
}

function pointInWorldRect(
  worldX: number,
  worldY: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    worldX >= rect.x &&
    worldX <= rect.x + rect.width &&
    worldY >= rect.y &&
    worldY <= rect.y + rect.height
  );
}

/** Parent frame for a newly placed instance when dropped into an exposed slot. */
export function resolveInstanceDropParentId(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  active: ActiveSlotEditState | null,
  worldX: number,
  worldY: number,
  pickDeepestAt: (x: number, y: number) => string | null,
): string | null {
  if (active) {
    const activeRect = worldRect(active.containerId, nodes);
    if (pointInWorldRect(worldX, worldY, activeRect)) return active.containerId;
  }
  const slot = findSlotPropertyAtWorldPoint(nodes, childOrder, worldX, worldY, pickDeepestAt);
  if (!slot) return null;
  const slotRect = worldRect(slot.containerId, nodes);
  return pointInWorldRect(worldX, worldY, slotRect) ? slot.containerId : null;
}

export function buildSlotEditBreadcrumb(
  nodes: Record<string, EditorNode>,
  scope: ResolvedSlotEditScope,
  prior: SlotEditBreadcrumbCrumb[] = [],
): SlotEditBreadcrumbCrumb[] {
  const inst = nodes[scope.instanceRootId];
  const instName = inst?.name ?? "Instance";
  const next: SlotEditBreadcrumbCrumb[] = [
    ...prior,
    {
      label: `${instName} / ${scope.label}`,
      instanceRootId: scope.instanceRootId,
      propertyKey: scope.propertyKey,
      containerId: scope.containerId,
    },
  ];
  return next;
}
