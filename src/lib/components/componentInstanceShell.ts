import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { isPassThroughWrapper } from "@/lib/webImport/normalizeWebImportLayers";
import { masterNodeIdForStableId } from "@/lib/components/stableIds";

/** Detect a single-child pass-through frame and record the inner layer for instance placement. */
export function detectComponentInstanceContentStableId(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
  stableIds: Record<string, string>,
): string | undefined {
  const root = nodes[masterRootId];
  if (!root) return undefined;
  const kidIds = childOrder[masterRootId] ?? [];
  if (kidIds.length !== 1) return undefined;
  const child = nodes[kidIds[0]!];
  if (!child || !isPassThroughWrapper(root, [child])) return undefined;
  return stableIds[kidIds[0]!];
}

export function masterSubtreeSyncRootId(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
): string {
  const master = nodes[masterRootId];
  if (!master?.componentInstanceContentStableId) return masterRootId;
  return (
    masterNodeIdForStableId(master, master.componentInstanceContentStableId) ?? masterRootId
  );
}

export function instanceRootStableIdForMaster(
  master: EditorNode,
  masterRootId: string,
): string | undefined {
  if (master.componentInstanceContentStableId) return master.componentInstanceContentStableId;
  return master.componentLayerStableIds?.[masterRootId];
}

export function isMasterShellStableId(
  master: EditorNode,
  masterRootId: string,
  stableId: string,
): boolean {
  const shellStableId = master.componentLayerStableIds?.[masterRootId];
  return Boolean(
    master.componentInstanceContentStableId && shellStableId && stableId === shellStableId,
  );
}

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

/**
 * Promote the inner content layer to the instance root so canvas instances
 * omit the pass-through shell frame that remains on the component master.
 */
export function unwrapComponentInstanceContentShell(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  masterId: string,
): string {
  const master = nodes[masterId];
  let contentStableId = master?.componentInstanceContentStableId;
  if (!contentStableId && master?.componentLayerStableIds) {
    contentStableId = detectComponentInstanceContentStableId(
      nodes,
      childOrder,
      masterId,
      master.componentLayerStableIds,
    );
  }
  if (!contentStableId) return instanceRootId;

  const wrapperId = instanceRootId;
  const wrapper = nodes[wrapperId];
  if (!wrapper?.sourceComponentId) return instanceRootId;

  const stableMap = { ...(wrapper.instanceStableIdMap ?? {}) };
  let contentInstanceId: string | null = null;
  for (const [nodeId, stableId] of Object.entries(stableMap)) {
    if (stableId === contentStableId) {
      contentInstanceId = nodeId;
      break;
    }
  }
  if (!contentInstanceId || contentInstanceId === wrapperId) return instanceRootId;

  const content = nodes[contentInstanceId];
  if (!content) return instanceRootId;

  const parentId = wrapper.parentId;
  const parentKey = parentListKey(parentId);
  delete stableMap[wrapperId];

  nodes[contentInstanceId] = {
    ...content,
    parentId,
    x: wrapper.x + content.x,
    y: wrapper.y + content.y,
    sourceComponentId: wrapper.sourceComponentId,
    componentId: wrapper.componentId,
    variantGroupId: wrapper.variantGroupId,
    selectedVariantProperties: wrapper.selectedVariantProperties,
    componentVersionAtInsert: wrapper.componentVersionAtInsert,
    componentPropertyValues: wrapper.componentPropertyValues,
    currentInteractiveVariantValues: wrapper.currentInteractiveVariantValues,
    interactionState: wrapper.interactionState,
    instanceStableIdMap: stableMap,
    instanceOverrides: wrapper.instanceOverrides,
    instanceOverridesByStableId: wrapper.instanceOverridesByStableId,
    resolvedTreeCacheVersion: wrapper.resolvedTreeCacheVersion,
  };

  for (const id of collectSubtreeIds(wrapperId, childOrder)) {
    if (id === contentInstanceId) continue;
    delete nodes[id];
  }

  const parentList = childOrder[parentKey] ?? [];
  childOrder[parentKey] = parentList.map((id) => (id === wrapperId ? contentInstanceId! : id));
  delete childOrder[wrapperId];

  return contentInstanceId;
}
