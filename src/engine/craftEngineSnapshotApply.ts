import type { CraftEngineDocument } from "@/engine/craftEngineTypes";
import { EDITOR_ROOT_KEY, EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import { defaultLayerNameForNode } from "@/lib/layerNaming";
import type { EditorNode } from "@/stores/useEditorStore";

export type WasmSnapshotStorePatch = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
};

function resolveLayerName(
  incoming: EditorNode,
  previous: EditorNode | undefined,
  nodes: Record<string, EditorNode>,
): string {
  const fromPrevious = previous?.name?.trim();
  if (fromPrevious) return fromPrevious;
  const fromIncoming = incoming.name?.trim();
  if (fromIncoming) return fromIncoming;
  return defaultLayerNameForNode(incoming, nodes);
}

/** Style / fill fields WASM `NodeInput` does not round-trip — keep store values when absent. */
const WASM_STYLE_PRESERVE_KEYS: (keyof EditorNode)[] = [
  "arcStartDeg",
  "arcSweepDeg",
  "arcInnerRadiusRatio",
  "fillGradient",
  "fillType",
  "fillImageAssetId",
  "fillVideoAssetId",
  "fillPatternAssetId",
  "fillTokenId",
  "strokeGradient",
  "strokeType",
  "strokeImageAssetId",
  "strokeVideoAssetId",
  "effects",
  "blendMode",
  "isBooleanGroup",
  "booleanOperation",
  "maskId",
  "isMask",
  "figMaskType",
  "maskVisible",
  "strokeSides",
  "strokeSidesCustom",
  "strokeSidesCustomColors",
  "starInnerRadius",
  "starPoints",
  "polygonSides",
  "layoutMode",
  "layoutGap",
  "layoutGapAuto",
  "layoutWrap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "primaryAxisAlign",
  "counterAxisAlign",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "layoutPositioning",
  "layoutGrow",
  "clipChildren",
  "computedWidth",
  "computedHeight",
  "layoutDirty",
  "textResizeMode",
  "autoResize",
];

function isAutoLayoutFlowChild(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  const parentId = node.parentId;
  if (!parentId) return false;
  const parent = nodes[parentId];
  if (!parent) return false;
  if ((parent.layoutMode ?? "none") === "none") return false;
  return (node.layoutPositioning ?? "auto") !== "absolute";
}

function isAutoLayoutContainer(node: EditorNode): boolean {
  return (node.type === "frame" || node.type === "group") && (node.layoutMode ?? "none") !== "none";
}

function preserveAutoLayoutGeometry(
  previous: EditorNode,
  merged: EditorNode,
  previousNodes: Record<string, EditorNode>,
): EditorNode {
  if (isAutoLayoutContainer(previous)) {
    return {
      ...merged,
      width: previous.width,
      height: previous.height,
      computedWidth: previous.computedWidth ?? merged.computedWidth,
      computedHeight: previous.computedHeight ?? merged.computedHeight,
    };
  }
  if (!isAutoLayoutFlowChild(previous, previousNodes)) return merged;
  return {
    ...merged,
    x: previous.x,
    y: previous.y,
    width: previous.width,
    height: previous.height,
    computedWidth: previous.computedWidth ?? merged.computedWidth,
    computedHeight: previous.computedHeight ?? merged.computedHeight,
    layoutDirty: previous.layoutDirty ?? merged.layoutDirty,
  };
}

function mergeNestedStroke(
  previous: EditorNode | undefined,
  incoming: EditorNode,
): EditorNode["stroke"] | undefined {
  const prevStroke = previous?.stroke;
  const incomingStroke = incoming.stroke;
  if (incomingStroke == null) return prevStroke;
  if (prevStroke == null) return incomingStroke;
  return { ...prevStroke, ...incomingStroke };
}

/** Merge WASM geometry with existing store metadata (names, expanded, components, etc.). */
export function mergeWasmSnapshotWithStore(
  previousNodes: Record<string, EditorNode>,
  patch: WasmSnapshotStorePatch,
): WasmSnapshotStorePatch {
  const mergedNodes: Record<string, EditorNode> = {};
  const namingContext: Record<string, EditorNode> = { ...previousNodes };

  for (const [id, incoming] of Object.entries(patch.nodes)) {
    const previous = previousNodes[id];
    if (previous) {
      const preserved: Partial<EditorNode> = {};
      for (const key of WASM_STYLE_PRESERVE_KEYS) {
        if (incoming[key] === undefined && previous[key] !== undefined) {
          (preserved as Record<string, unknown>)[key] = previous[key];
        }
      }
      const mergedStroke = mergeNestedStroke(previous, incoming);
      const merged: EditorNode = {
        ...previous,
        ...incoming,
        ...preserved,
        ...(mergedStroke !== undefined ? { stroke: mergedStroke } : {}),
        name: resolveLayerName(incoming, previous, namingContext),
        expanded: previous.expanded ?? incoming.expanded ?? true,
      };
      mergedNodes[id] = preserveAutoLayoutGeometry(previous, merged, previousNodes);
    } else {
      mergedNodes[id] = {
        ...incoming,
        parentId: incoming.parentId ?? null,
        rotation: incoming.rotation ?? 0,
        visible: incoming.visible ?? true,
        locked: incoming.locked ?? false,
        expanded: incoming.expanded ?? true,
        name: resolveLayerName(incoming, undefined, namingContext),
      };
    }
    namingContext[id] = mergedNodes[id]!;
  }

  return {
    nodes: mergedNodes,
    childOrder: patch.childOrder,
  };
}

/** Parse WASM `snapshotDocument()` JSON into a store patch (geometry + tree). */
export function wasmSnapshotToStorePatch(json: string): WasmSnapshotStorePatch | null {
  let doc: CraftEngineDocument;
  try {
    doc = JSON.parse(json) as CraftEngineDocument;
  } catch {
    return null;
  }
  if (!doc.nodes || !doc.childOrder) return null;

  const nodes: Record<string, EditorNode> = {};
  for (const [id, raw] of Object.entries(doc.nodes)) {
    nodes[id] = structuredClone(raw as EditorNode);
  }

  const childOrder = structuredClone(doc.childOrder);
  const rootIds = doc.rootIds ?? childOrder[EDITOR_ROOT_KEY] ?? EMPTY_CHILD_IDS;
  childOrder[EDITOR_ROOT_KEY] = [...rootIds];

  return { nodes, childOrder };
}
