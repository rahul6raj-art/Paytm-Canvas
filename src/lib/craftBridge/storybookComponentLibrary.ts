import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorAsset } from "@/lib/documentPersistence";
import { markNodeAsComponent } from "@/lib/componentModel";
import { combineMastersAsVariantSet } from "@/lib/components/componentSet";
import {
  storybookVariantMasterName,
  type StorybookComponentStory,
} from "@/lib/craftBridge/storybookCatalog";
import type { EditorNode } from "@/stores/useEditorStore";

export const STORYBOOK_LIBRARY_CONTAINER_NAME = "— Storybook components —";
export const STORYBOOK_LIBRARY_X = -32000;
export const STORYBOOK_LIBRARY_Y = 0;
const STORYBOOK_MASTER_GAP = 48;

export type StorybookCaptureSlice = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
};

function remapCaptureIds(
  capture: StorybookCaptureSlice,
  idPrefix: string,
): StorybookCaptureSlice | null {
  const rootIds = capture.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (rootIds.length !== 1) return null;
  const oldRootId = rootIds[0]!;
  if (!capture.nodes[oldRootId]) return null;

  const idMap = new Map<string, string>();
  const walk = (oldId: string) => {
    const node = capture.nodes[oldId];
    if (!node) return;
    const newId = `${idPrefix}${oldId}`;
    idMap.set(oldId, newId);
    for (const cid of capture.childOrder[oldId] ?? []) walk(cid);
  };
  walk(oldRootId);
  const remappedRootId = idMap.get(oldRootId);
  if (!remappedRootId) return null;

  const nodes: Record<string, EditorNode> = {};
  for (const [oldId, newId] of idMap) {
    const node = capture.nodes[oldId];
    if (!node) continue;
    const parentOld = node.parentId;
    nodes[newId] = {
      ...node,
      id: newId,
      parentId: parentOld ? idMap.get(parentOld) ?? null : null,
    };
  }

  const childOrder: Record<string, string[]> = {};
  for (const [oldId, newId] of idMap) {
    childOrder[newId] = (capture.childOrder[oldId] ?? [])
      .map((cid) => idMap.get(cid))
      .filter((cid): cid is string => Boolean(cid));
  }

  const assets: Record<string, EditorAsset> = {};
  for (const [assetId, asset] of Object.entries(capture.assets ?? {})) {
    const newAssetId = `${idPrefix}${assetId}`;
    assets[newAssetId] = { ...asset, id: newAssetId };
    for (const node of Object.values(nodes)) {
      if (node.assetId === assetId) node.assetId = newAssetId;
      if (node.fillImageAssetId === assetId) node.fillImageAssetId = newAssetId;
      if (node.fillVideoAssetId === assetId) node.fillVideoAssetId = newAssetId;
    }
  }

  return { nodes, childOrder, assets };
}

export function findStorybookLibraryContainerId(
  nodes: Record<string, EditorNode>,
): string | undefined {
  return Object.values(nodes).find(
    (n) =>
      n.parentId === null &&
      n.type === "frame" &&
      n.name === STORYBOOK_LIBRARY_CONTAINER_NAME,
  )?.id;
}

export function ensureStorybookLibraryContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const existing = findStorybookLibraryContainerId(nodes);
  if (existing) return existing;

  const containerId = `storybook-lib-${Date.now()}`;
  nodes[containerId] = {
    id: containerId,
    parentId: null,
    type: "frame",
    name: STORYBOOK_LIBRARY_CONTAINER_NAME,
    x: STORYBOOK_LIBRARY_X,
    y: STORYBOOK_LIBRARY_Y,
    width: 1,
    height: 1,
    rotation: 0,
    visible: false,
    locked: true,
    expanded: false,
    fillEnabled: false,
    clipChildren: true,
  };
  const roots = childOrder[EDITOR_ROOT_KEY] ?? [];
  childOrder[EDITOR_ROOT_KEY] = [...roots, containerId];
  childOrder[containerId] = [];
  return containerId;
}

function existingStoryMasterForStoryId(
  nodes: Record<string, EditorNode>,
  storyId: string,
): EditorNode | undefined {
  return Object.values(nodes).find(
    (n) => n.isComponent && n.remoteComponentId === storyId,
  );
}

function stackOffsetY(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): number {
  let maxBottom = 0;
  for (const cid of childOrder[containerId] ?? []) {
    const child = nodes[cid];
    if (!child?.visible) continue;
    maxBottom = Math.max(maxBottom, child.y + child.height);
  }
  return maxBottom > 0 ? maxBottom + STORYBOOK_MASTER_GAP : 0;
}

export function mergeStorybookCaptureAsMaster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  assets: Record<string, EditorAsset>,
  containerId: string,
  capture: StorybookCaptureSlice,
  story: StorybookComponentStory,
): string | null {
  const existing = existingStoryMasterForStoryId(nodes, story.id);
  if (existing) return existing.id;

  const idPrefix = `sb-${story.id.replace(/[^a-z0-9]+/gi, "-")}-`;
  const remapped = remapCaptureIds(capture, idPrefix);
  if (!remapped) return null;

  const remappedRootId = Object.keys(remapped.nodes).find(
    (id) => remapped.nodes[id]?.parentId === null,
  );
  if (!remappedRootId) return null;

  const y = stackOffsetY(nodes, childOrder, containerId);
  remapped.nodes[remappedRootId] = {
    ...remapped.nodes[remappedRootId]!,
    parentId: containerId,
    x: 0,
    y,
    name: storybookVariantMasterName(story.title, story.name),
    remoteComponentId: story.id,
    publishStatus: "library",
    variantProperties: story.variantProperties,
  };

  Object.assign(nodes, remapped.nodes);
  Object.assign(assets, remapped.assets);
  for (const [parentId, kids] of Object.entries(remapped.childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    childOrder[parentId] = kids;
  }
  childOrder[containerId] = [...(childOrder[containerId] ?? []), remappedRootId];

  const marked = markNodeAsComponent(nodes, childOrder, remappedRootId);
  Object.assign(nodes, marked);
  return remappedRootId;
}

/** Combine captured variant masters into a Figma-style component set with a style-panel dropdown. */
export function finalizeStorybookComponentGroup(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterIds: string[],
): string | null {
  if (masterIds.length < 2) return masterIds[0] ?? null;
  const combined = combineMastersAsVariantSet(nodes, childOrder, masterIds);
  if (!combined) return masterIds[0] ?? null;
  Object.assign(nodes, combined.nodes);
  Object.assign(childOrder, combined.childOrder);
  return combined.setContainerId;
}

export function listStorybookComponentMasters(
  nodes: Record<string, EditorNode>,
): EditorNode[] {
  return Object.values(nodes).filter(
    (n) => n.isComponent && Boolean(n.remoteComponentId?.trim()),
  );
}

/** Story ids already present as component masters (for incremental Storybook sync). */
export function importedStorybookStoryIds(nodes: Record<string, EditorNode>): Set<string> {
  return new Set(
    listStorybookComponentMasters(nodes)
      .map((m) => m.remoteComponentId?.trim())
      .filter((id): id is string => Boolean(id)),
  );
}
