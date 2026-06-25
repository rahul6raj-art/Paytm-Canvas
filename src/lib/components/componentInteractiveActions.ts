import type { EditorNode } from "@/stores/useEditorStore";
import { resolveMasterRootId } from "@/lib/componentModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { collectSubtreeIds } from "@/lib/editorGraph";
import {
  preserveOverridesOnSwap,
  resolveVariantMasterId,
} from "@/lib/components/resolveInstance";
import { readInstanceOverrideMap, writeInstanceOverrideState } from "@/lib/components/overrides";
import {
  baseVariantValuesForInstance,
  effectiveVariantValuesForInstance,
  findInteractionForTrigger,
  interactionsForVariantGroup,
  mergeInteractionState,
  resolveInteractionTargetVariant,
  shouldRespondToInteractionTrigger,
  type ComponentInteractionTrigger,
  type InstanceInteractionState,
} from "@/lib/components/componentInteractions";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

function masterIdForEffectiveVariant(
  nodes: Record<string, EditorNode>,
  instanceRoot: EditorNode,
  effectiveVariant: Record<string, string> | undefined,
): string {
  return resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    effectiveVariant,
    instanceRoot.sourceComponentId!,
  );
}

function swapInstanceToMasterPreservingBaseVariant(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  newMasterId: string,
  patch: Partial<EditorNode>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) return null;
  const newMaster = nodes[newMasterId];
  if (!newMaster?.isComponent) return null;

  const preserved = preserveOverridesOnSwap(instanceRoot, newMaster, instanceRoot.instanceStableIdMap ?? {});
  const parentId = instanceRoot.parentId;
  const parentKey = parentListKey(parentId);
  const list = childOrder[parentKey] ?? [];
  const insertIdx = list.indexOf(instanceRootId);

  const built = buildInstanceFromMaster(
    nodes,
    childOrder,
    newMasterId,
    parentId,
    instanceRoot.x,
    instanceRoot.y,
    instanceRoot.selectedVariantProperties,
  );
  if (!built) return null;

  let nextNodes = { ...built.nodes };
  let nextOrder = { ...built.childOrder };

  const oldIds = collectSubtreeIds(instanceRootId, childOrder);
  for (const oid of oldIds) delete nextNodes[oid];

  const newList = (nextOrder[parentKey] ?? []).filter((id) => !oldIds.includes(id));
  if (insertIdx >= 0) newList.splice(insertIdx, 0, built.newRootId);
  else newList.push(built.newRootId);
  nextOrder = { ...nextOrder, [parentKey]: newList };

  nextNodes[built.newRootId] = writeInstanceOverrideState(
    { ...nextNodes[built.newRootId]!, ...patch },
    preserved,
  );

  return { nodes: nextNodes, childOrder: nextOrder, newRootId: built.newRootId };
}

export function buildApplyInteractiveVariantResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  interactiveVariantValues: Record<string, string> | null,
  interactionStatePatch?: Partial<InstanceInteractionState>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;

  const baseVariant = baseVariantValuesForInstance(root);
  const effectiveVariant = interactiveVariantValues ?? baseVariant;
  const currentEffective = effectiveVariantValuesForInstance(root);
  const currentMasterId = masterIdForEffectiveVariant(nodes, root, currentEffective);
  const targetMasterId = masterIdForEffectiveVariant(nodes, root, effectiveVariant);

  const patch: Partial<EditorNode> = {
    currentInteractiveVariantValues: interactiveVariantValues ?? undefined,
    interactionState: mergeInteractionState(root.interactionState, interactionStatePatch ?? {}),
  };

  let nextNodes = { ...nodes, [instanceRootId]: { ...root, ...patch } };
  let nextOrder = childOrder;
  let nextRootId = instanceRootId;

  if (targetMasterId !== currentMasterId) {
    const swapped = swapInstanceToMasterPreservingBaseVariant(
      nextNodes,
      nextOrder,
      instanceRootId,
      targetMasterId,
      patch,
    );
    if (!swapped) return null;
    nextNodes = swapped.nodes;
    nextOrder = swapped.childOrder;
    nextRootId = swapped.newRootId;
  }

  const resolved = resolveComponentInstance(nextNodes, nextOrder, nextRootId, { force: true });
  return { nodes: resolved.nodes, childOrder: resolved.childOrder, newRootId: nextRootId };
}

export function buildTriggerInteractiveVariantResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  targetVariantValues: Record<string, string>,
  interactionStatePatch?: Partial<InstanceInteractionState>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  return buildApplyInteractiveVariantResult(
    nodes,
    childOrder,
    instanceRootId,
    targetVariantValues,
    interactionStatePatch,
  );
}

export function buildResetInteractiveVariantResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  interactionStatePatch?: Partial<InstanceInteractionState>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  return buildApplyInteractiveVariantResult(nodes, childOrder, instanceRootId, null, interactionStatePatch);
}

export function clearEphemeralInteractiveFields(
  nodes: Record<string, EditorNode>,
): Record<string, EditorNode> {
  let changed = false;
  const next: Record<string, EditorNode> = { ...nodes };
  for (const [id, n] of Object.entries(nodes)) {
    if (!n.currentInteractiveVariantValues && !n.interactionState) continue;
    const { currentInteractiveVariantValues: _c, interactionState: _s, ...rest } = n;
    next[id] = rest;
    changed = true;
  }
  return changed ? next : nodes;
}

export function applyInstanceInteractionTrigger(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  trigger: ComponentInteractionTrigger,
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  newRootId: string;
  applied: boolean;
  usedFallback: boolean;
  warning?: string;
} | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId || !root.variantGroupId) return null;

  if (!shouldRespondToInteractionTrigger(root, nodes, trigger)) {
    return { nodes, childOrder, newRootId: instanceRootId, applied: false, usedFallback: false };
  }

  const interactions = interactionsForVariantGroup(nodes, root.variantGroupId);
  const current = effectiveVariantValuesForInstance(root);

  if (trigger === "ON_MOUSE_LEAVE") {
    const leaveHit = findInteractionForTrigger(interactions, current, "ON_MOUSE_LEAVE");
    const base = baseVariantValuesForInstance(root);
    if (
      leaveHit &&
      base &&
      Object.entries(leaveHit.action.targetVariantValues).every(([k, v]) => base[k] === v)
    ) {
      const result = buildResetInteractiveVariantResult(nodes, childOrder, instanceRootId, {
        hovered: false,
        pressed: false,
      });
      if (!result) return null;
      return { ...result, applied: true, usedFallback: false };
    }
    const result = leaveHit
      ? buildTriggerInteractiveVariantResult(
          nodes,
          childOrder,
          instanceRootId,
          leaveHit.action.targetVariantValues,
          { hovered: false, pressed: false },
        )
      : buildResetInteractiveVariantResult(nodes, childOrder, instanceRootId, {
          hovered: false,
          pressed: false,
        });
    if (!result) return null;
    return { ...result, applied: true, usedFallback: false };
  }

  const hit = findInteractionForTrigger(interactions, current, trigger);
  if (!hit || hit.action.type !== "CHANGE_TO_VARIANT") {
    const statePatch: Partial<InstanceInteractionState> = {};
    if (trigger === "ON_MOUSE_ENTER" || trigger === "ON_HOVER") statePatch.hovered = true;
    if (trigger === "ON_PRESS") statePatch.pressed = true;
    if (trigger === "ON_RELEASE") statePatch.pressed = false;
    if (trigger === "ON_FOCUS") statePatch.focused = true;
    if (trigger === "ON_BLUR") statePatch.focused = false;
    if (Object.keys(statePatch).length === 0) {
      return { nodes, childOrder, newRootId: instanceRootId, applied: false, usedFallback: false };
    }
    const result = buildApplyInteractiveVariantResult(
      nodes,
      childOrder,
      instanceRootId,
      root.currentInteractiveVariantValues ?? null,
      statePatch,
    );
    if (!result) return null;
    return { ...result, applied: false, usedFallback: false };
  }

  const { usedFallback } = resolveInteractionTargetVariant(
    nodes,
    root.variantGroupId,
    hit.action.targetVariantValues,
    root.sourceComponentId,
  );

  const statePatch: Partial<InstanceInteractionState> = {};
  if (trigger === "ON_MOUSE_ENTER" || trigger === "ON_HOVER") statePatch.hovered = true;
  if (trigger === "ON_PRESS") statePatch.pressed = true;
  if (trigger === "ON_RELEASE") statePatch.pressed = false;
  if (trigger === "ON_FOCUS") statePatch.focused = true;
  if (trigger === "ON_BLUR") statePatch.focused = false;

  const result = buildTriggerInteractiveVariantResult(
    nodes,
    childOrder,
    instanceRootId,
    hit.action.targetVariantValues,
    statePatch,
  );
  if (!result) return null;

  return {
    ...result,
    applied: true,
    usedFallback,
    warning: usedFallback ? "Interactive target variant missing; used nearest fallback." : undefined,
  };
}

export function resolveMasterKeyForInstance(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
): string | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const masterId = masterIdForEffectiveVariant(nodes, root, effectiveVariantValuesForInstance(root));
  return resolveMasterRootId(nodes, masterId) ?? masterId;
}
