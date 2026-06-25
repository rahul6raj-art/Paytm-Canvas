import type { EditorNode } from "@/stores/useEditorStore";
import type { InstanceOverridePatch } from "@/lib/componentModel";
import type {
  ComponentInteraction,
  InstanceInteractionState,
} from "@/lib/components/componentInteractions";

/** Exposed component property definition on a main component. */
export type ComponentPropertyKind =
  | "boolean"
  | "text"
  | "instanceSwap"
  | "variant"
  | "slot";

export type ComponentPropertyDef = {
  id: string;
  key: string;
  label: string;
  kind: ComponentPropertyKind;
  /** Stable layer id this property binds to (direct nested slot on parent master). */
  targetStableLayerId: string;
  /** Stable path binding for nested swap targets, e.g. `headerSlot/buttonSlot/iconSlot`. */
  targetStablePath?: string;
  /** Property path on the target layer, e.g. `visible`, `content`, `componentId`. */
  targetPath: string;
  defaultValue?: string | boolean;
  /** For instanceSwap: default component definition id from the main component. */
  defaultComponentId?: string;
  /** For instanceSwap: preferred component definition ids shown first in the dropdown. */
  preferredComponentIds?: string[];
  /** For instanceSwap: when true, all local components are searchable in the dropdown. */
  allowAnyComponent?: boolean;
  /** For slot: serialized default children of the slot container. */
  defaultSlotContent?: SlotContentSnapshot;
  /** For slot: allowed node types that can be placed in the slot. */
  allowedSlotTypes?: SlotAllowedType[];
  /** For slot: when true, the slot may have zero children. */
  allowEmpty?: boolean;
  /** For variant: property axis name when kind is variant. */
  variantAxis?: string;
};

export type SlotAllowedType = "TEXT" | "FRAME" | "INSTANCE" | "SHAPE" | "ANY";

/** Serialized subtree placed inside a slot container on an instance. */
export type SlotContentSnapshot = {
  version: 1;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  rootChildIds: string[];
};

export const SLOT_CONTENT_PATH = "content";
export const SLOT_OVERRIDE_PREFIX = "slot:";

export type ComponentDefinition = {
  id: string;
  name: string;
  description?: string;
  masterNodeId: string;
  /** nodeId → stable internal layer id */
  layerStableIds: Record<string, string>;
  exposedProperties: ComponentPropertyDef[];
  variantGroupId?: string;
  variantProperties?: Record<string, string>;
  version: number;
  libraryId?: string;
  remoteComponentId?: string;
  publishStatus?: "local" | "published" | "library";
  lastPublishedVersion?: number;
  updateAvailable?: boolean;
};

/** Override keyed by stable layer id → property path → value */
export type OverrideMap = Record<string, Record<string, unknown>>;

export type ResolvedInstanceMeta = {
  instanceRootId: string;
  componentId: string;
  masterNodeId: string;
  selectedVariant?: Record<string, string>;
  componentPropertyValues: Record<string, string | boolean>;
  overrideMap: OverrideMap;
  componentVersion: number;
  detached: boolean;
};

export type InstanceResolution = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  rootId: string;
  meta: ResolvedInstanceMeta;
  appliedOverrideCount: number;
  droppedOverrides: string[];
};

export type ComponentDebugInfo = ResolvedInstanceMeta & {
  exposedProperties: ComponentPropertyDef[];
  matchedLayers: { stableId: string; instanceNodeId: string; masterNodeId: string; stablePath?: string }[];
  nestedInstances?: import("@/lib/components/stablePaths").NestedInstanceDebugPath[];
  resolvedTreeSource: "master+overrides" | "detached-clone";
  cacheStatus: "hit" | "miss" | "dirty";
  appliedOverrideCount: number;
  droppedOverrides: string[];
  masterVersion: number;
  instanceComponentVersion: number;
  stale: boolean;
  lastPropagationReason?: string;
  changedStableIds?: string[];
  layoutInvalidationReason?: string;
  nestedDependencyPath?: string[];
  slots?: SlotDebugInfo[];
};

export type SlotDebugInfo = {
  propertyKey: string;
  label: string;
  targetStablePath: string;
  active: boolean;
  overridden: boolean;
  resolvedNodeCount: number;
  dropped?: boolean;
};

export type InstanceOverridePatchStable = InstanceOverridePatch;
