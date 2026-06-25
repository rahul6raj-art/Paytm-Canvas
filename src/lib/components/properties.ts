import type { ComponentPropertyDef, SlotAllowedType, SlotContentSnapshot } from "@/lib/components/types";
import { newStableLayerId } from "@/lib/components/stableIds";

export function newComponentPropertyId(): string {
  return `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createBooleanProperty(
  key: string,
  label: string,
  targetStableLayerId: string,
  defaultValue = true,
): ComponentPropertyDef {
  return {
    id: newComponentPropertyId(),
    key,
    label,
    kind: "boolean",
    targetStableLayerId,
    targetPath: "visible",
    defaultValue,
  };
}

export function createTextProperty(
  key: string,
  label: string,
  targetStableLayerId: string,
  defaultValue = "",
): ComponentPropertyDef {
  return {
    id: newComponentPropertyId(),
    key,
    label,
    kind: "text",
    targetStableLayerId,
    targetPath: "content",
    defaultValue,
  };
}

export function createInstanceSwapProperty(
  key: string,
  label: string,
  targetStableLayerId: string,
  defaultComponentId: string,
  options?: {
    targetStablePath?: string;
    preferredComponentIds?: string[];
    allowAnyComponent?: boolean;
  },
): ComponentPropertyDef {
  return {
    id: newComponentPropertyId(),
    key,
    label,
    kind: "instanceSwap",
    targetStableLayerId,
    targetStablePath: options?.targetStablePath,
    targetPath: "componentId",
    defaultComponentId,
    preferredComponentIds: options?.preferredComponentIds ?? [defaultComponentId],
    allowAnyComponent: options?.allowAnyComponent ?? true,
  };
}

export function createVariantProperty(axis: string, label?: string): ComponentPropertyDef {
  return {
    id: newComponentPropertyId(),
    key: axis,
    label: label ?? axis,
    kind: "variant",
    targetStableLayerId: "",
    targetPath: "variant",
    variantAxis: axis,
  };
}

export function createSlotProperty(
  key: string,
  label: string,
  targetStableLayerId: string,
  options?: {
    targetStablePath?: string;
    defaultSlotContent?: SlotContentSnapshot;
    allowedSlotTypes?: SlotAllowedType[];
    allowEmpty?: boolean;
  },
): ComponentPropertyDef {
  return {
    id: newComponentPropertyId(),
    key,
    label,
    kind: "slot",
    targetStableLayerId,
    targetStablePath: options?.targetStablePath,
    targetPath: "slot",
    defaultSlotContent: options?.defaultSlotContent,
    allowedSlotTypes: options?.allowedSlotTypes ?? ["ANY"],
    allowEmpty: options?.allowEmpty ?? false,
  };
}
