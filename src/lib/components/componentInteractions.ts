import type { EditorNode } from "@/stores/useEditorStore";
import { listComponentMasters } from "@/lib/componentModel";
import {
  buildComponentSet,
  resolveVariantMasterIdWithFallback,
  type ComponentSet,
} from "@/lib/components/componentSet";

export type ComponentInteractionTrigger =
  | "ON_HOVER"
  | "ON_MOUSE_ENTER"
  | "ON_MOUSE_LEAVE"
  | "ON_PRESS"
  | "ON_RELEASE"
  | "ON_CLICK"
  | "ON_FOCUS"
  | "ON_BLUR";

export type ComponentInteractionTransitionType = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";

export type ComponentInteractionTransition = {
  type: ComponentInteractionTransitionType;
  durationMs?: number;
  easing?: string;
};

export type ComponentInteractionAction = {
  type: "CHANGE_TO_VARIANT";
  targetVariantValues: Record<string, string>;
  transition?: ComponentInteractionTransition;
};

export type ComponentInteraction = {
  id: string;
  fromVariantValues: Record<string, string>;
  trigger: ComponentInteractionTrigger;
  action: ComponentInteractionAction;
};

export type InstanceInteractionState = {
  hovered: boolean;
  pressed: boolean;
  focused: boolean;
  disabled: boolean;
};

export const DEFAULT_INTERACTION_STATE: InstanceInteractionState = {
  hovered: false,
  pressed: false,
  focused: false,
  disabled: false,
};

export function newComponentInteractionId(): string {
  return `cint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultComponentInteraction(
  fromVariantValues: Record<string, string>,
  trigger: ComponentInteractionTrigger = "ON_MOUSE_ENTER",
  targetVariantValues: Record<string, string> = { State: "Hover" },
): ComponentInteraction {
  return {
    id: newComponentInteractionId(),
    fromVariantValues,
    trigger,
    action: {
      type: "CHANGE_TO_VARIANT",
      targetVariantValues,
      transition: { type: "INSTANT", durationMs: 0 },
    },
  };
}

/** Runtime variant values: interactive override when active, else inspector selection. */
export function effectiveVariantValuesForInstance(instanceRoot: EditorNode): Record<string, string> | undefined {
  return instanceRoot.currentInteractiveVariantValues ?? instanceRoot.selectedVariantProperties;
}

export function baseVariantValuesForInstance(instanceRoot: EditorNode): Record<string, string> | undefined {
  return instanceRoot.selectedVariantProperties;
}

export function variantValuesMatch(
  current: Record<string, string> | undefined,
  from: Record<string, string>,
): boolean {
  if (!current) return Object.keys(from).length === 0;
  return Object.entries(from).every(([k, v]) => current[k] === v);
}

export function isDisabledVariantValues(values: Record<string, string> | undefined): boolean {
  if (!values) return false;
  return Object.values(values).some((v) => String(v).toLowerCase() === "disabled");
}

export function isInstanceInteractionDisabled(
  instanceRoot: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  if (instanceRoot.interactionState?.disabled) return true;
  const base = baseVariantValuesForInstance(instanceRoot);
  const effective = effectiveVariantValuesForInstance(instanceRoot);
  return isDisabledVariantValues(base) || isDisabledVariantValues(effective);
}

export function interactionsForVariantGroup(
  nodes: Record<string, EditorNode>,
  variantGroupId: string | undefined,
): ComponentInteraction[] {
  if (!variantGroupId) return [];
  const master = listComponentMasters(nodes).find((m) => m.variantGroupId === variantGroupId);
  return master?.componentInteractions ?? [];
}

export function syncInteractionsToVariantGroup(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  interactions: ComponentInteraction[],
): Record<string, EditorNode> {
  let next = { ...nodes };
  for (const m of listComponentMasters(nodes)) {
    if (m.variantGroupId !== variantGroupId) continue;
    next[m.id] = { ...m, componentInteractions: interactions };
  }
  return next;
}

export function findInteractionForTrigger(
  interactions: ComponentInteraction[],
  currentVariantValues: Record<string, string> | undefined,
  trigger: ComponentInteractionTrigger,
): ComponentInteraction | null {
  for (const interaction of interactions) {
    if (interaction.trigger !== trigger) continue;
    if (!variantValuesMatch(currentVariantValues, interaction.fromVariantValues)) continue;
    return interaction;
  }
  return null;
}

export function resolveInteractionTargetVariant(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  targetVariantValues: Record<string, string>,
  fallbackMasterId: string,
): { masterId: string; usedFallback: boolean } {
  const resolved = resolveVariantMasterIdWithFallback(
    nodes,
    variantGroupId,
    targetVariantValues,
    fallbackMasterId,
  );
  const exact = listComponentMasters(nodes).find((m) => {
    if (m.variantGroupId !== variantGroupId) return false;
    const vp = m.variantProperties ?? {};
    return Object.entries(targetVariantValues).every(([k, v]) => vp[k] === v);
  });
  return { masterId: resolved, usedFallback: !exact || exact.id !== resolved };
}

export function targetVariantValuesForTrigger(
  nodes: Record<string, EditorNode>,
  instanceRoot: EditorNode,
  trigger: ComponentInteractionTrigger,
): Record<string, string> | null {
  const interactions = interactionsForVariantGroup(nodes, instanceRoot.variantGroupId);
  const current = effectiveVariantValuesForInstance(instanceRoot);
  const hit = findInteractionForTrigger(interactions, current, trigger);
  if (!hit || hit.action.type !== "CHANGE_TO_VARIANT") return null;
  return { ...hit.action.targetVariantValues };
}

export function shouldRespondToInteractionTrigger(
  instanceRoot: EditorNode,
  nodes: Record<string, EditorNode>,
  trigger: ComponentInteractionTrigger,
): boolean {
  if (isInstanceInteractionDisabled(instanceRoot, nodes)) {
    const interactions = interactionsForVariantGroup(nodes, instanceRoot.variantGroupId);
    const current = effectiveVariantValuesForInstance(instanceRoot);
    const hit = findInteractionForTrigger(interactions, current, trigger);
    if (!hit) return false;
    return trigger === "ON_CLICK" || trigger === "ON_FOCUS";
  }
  return true;
}

export function mergeInteractionState(
  prev: InstanceInteractionState | undefined,
  patch: Partial<InstanceInteractionState>,
): InstanceInteractionState {
  return { ...DEFAULT_INTERACTION_STATE, ...prev, ...patch };
}

export function buildComponentSetFromGroup(
  nodes: Record<string, EditorNode>,
  variantGroupId: string | undefined,
): ComponentSet | null {
  if (!variantGroupId) return null;
  return buildComponentSet(nodes, variantGroupId);
}

export const INTERACTION_TRIGGER_LABELS: Record<ComponentInteractionTrigger, string> = {
  ON_HOVER: "While hovering",
  ON_MOUSE_ENTER: "Mouse enter",
  ON_MOUSE_LEAVE: "Mouse leave",
  ON_PRESS: "While pressing",
  ON_RELEASE: "Mouse up",
  ON_CLICK: "On click",
  ON_FOCUS: "On focus",
  ON_BLUR: "On blur",
};

export const INTERACTION_TRANSITION_LABELS: Record<ComponentInteractionTransitionType, string> = {
  INSTANT: "Instant",
  DISSOLVE: "Dissolve",
  SMART_ANIMATE: "Smart animate",
};
