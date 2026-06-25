import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { findInstanceRoot, listComponentMasters } from "@/lib/componentModel";

export type ComponentDependencyGraph = {
  /** componentId → master root ids for that definition */
  componentIdToMasters: Map<string, Set<string>>;
  /** master root id → componentIds used as nested instances inside its subtree */
  masterToNestedComponentIds: Map<string, Set<string>>;
  /** componentId → canvas instance root ids */
  componentIdToInstanceRoots: Map<string, Set<string>>;
};

export function buildComponentDependencyGraph(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): ComponentDependencyGraph {
  const componentIdToMasters = new Map<string, Set<string>>();
  const masterToNestedComponentIds = new Map<string, Set<string>>();
  const componentIdToInstanceRoots = new Map<string, Set<string>>();

  for (const master of listComponentMasters(nodes)) {
    if (!master.componentId) continue;
    const masters = componentIdToMasters.get(master.componentId) ?? new Set<string>();
    masters.add(master.id);
    componentIdToMasters.set(master.componentId, masters);

    const nested = new Set<string>();
    for (const nodeId of collectSubtreeIds(master.id, childOrder)) {
      const n = nodes[nodeId];
      if (!n?.sourceComponentId || !n.componentId) continue;
      if (findInstanceRoot(nodes, nodeId) !== nodeId) continue;
      nested.add(n.componentId);
    }
    if (nested.size > 0) masterToNestedComponentIds.set(master.id, nested);
  }

  for (const n of Object.values(nodes)) {
    if (!n.sourceComponentId || !n.componentId) continue;
    if (findInstanceRoot(nodes, n.id) !== n.id) continue;
    const roots = componentIdToInstanceRoots.get(n.componentId) ?? new Set<string>();
    roots.add(n.id);
    componentIdToInstanceRoots.set(n.componentId, roots);
  }

  return { componentIdToMasters, masterToNestedComponentIds, componentIdToInstanceRoots };
}

/** Masters whose subtree contains a nested instance of `componentId`. */
export function findParentMastersUsingComponent(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  componentId: string,
): string[] {
  const graph = buildComponentDependencyGraph(nodes, childOrder);
  const out: string[] = [];
  for (const [masterId, nestedIds] of graph.masterToNestedComponentIds) {
    if (nestedIds.has(componentId)) out.push(masterId);
  }
  return out;
}

export function listInstanceRootsForComponentId(
  nodes: Record<string, EditorNode>,
  componentId: string,
): string[] {
  const roots: string[] = [];
  for (const n of Object.values(nodes)) {
    if (!n.sourceComponentId || n.componentId !== componentId) continue;
    if (findInstanceRoot(nodes, n.id) === n.id) roots.push(n.id);
  }
  return roots;
}

/** BFS cascade order: changed component → parent masters that embed it. */
export function cascadeMasterRootsForComponentChange(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  changedMasterRootId: string,
  visited = new Set<string>(),
): string[] {
  const master = nodes[changedMasterRootId];
  if (!master?.componentId || visited.has(changedMasterRootId)) return [];
  visited.add(changedMasterRootId);

  const order = [changedMasterRootId];
  for (const parentId of findParentMastersUsingComponent(nodes, childOrder, master.componentId)) {
    if (visited.has(parentId)) continue;
    order.push(...cascadeMasterRootsForComponentChange(nodes, childOrder, parentId, visited));
  }
  return order;
}
