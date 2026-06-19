import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds, topLevelSelectedIds } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { worldRect } from "@/lib/tree";

/** Visual / content overrides allowed on component instances */
export type InstanceOverridePatch = Partial<
  Pick<
    EditorNode,
    | "fill"
    | "fillOpacity"
    | "fillEnabled"
    | "strokeColor"
    | "strokeEnabled"
    | "strokeWidth"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeSidesCustomColors"
    | "cornerRadius"
    | "cornerRadii"
    | "textColor"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "letterSpacing"
    | "content"
    | "assetId"
    | "imageSrc"
    | "imageName"
    | "imageMimeType"
    | "imageFitMode"
    | "fillTokenId"
    | "textStyleTokenId"
    | "effectTokenId"
    | "opacity"
    | "blendMode"
    | "arcStartDeg"
    | "arcSweepDeg"
    | "arcInnerRadiusRatio"
    | "effects"
  >
>;

export function newComponentId(): string {
  return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newVariantGroupId(): string {
  return `vg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Walk up from nodeId to find the instance root (node with `sourceComponentId`). */
export function findInstanceRoot(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): string | null {
  let cur: string | null = nodeId;
  while (cur) {
    const n = nodes[cur];
    if (!n) return null;
    if (n.sourceComponentId) return cur;
    cur = n.parentId ?? null;
  }
  return null;
}

export function isInstanceDescendant(nodes: Record<string, EditorNode>, nodeId: string): boolean {
  return findInstanceRoot(nodes, nodeId) !== null;
}

export function mergeInstanceOverrides(
  base: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode {
  const rootId = findInstanceRoot(nodes, base.id);
  if (!rootId) return base;
  const root = nodes[rootId];
  const raw = root?.instanceOverrides?.[base.id];
  if (!raw || typeof raw !== "object") return base;
  const ov = raw as InstanceOverridePatch;
  return { ...base, ...ov };
}

/** Strip component / instance metadata from a node (used when cloning for instances). */
export function stripComponentFields(n: EditorNode): EditorNode {
  const {
    isComponent: _ic,
    componentId: _ci,
    sourceComponentId: _sc,
    instanceOverrides: _io,
    variantGroupId: _vg,
    variantProperties: _vp,
    ...rest
  } = n;
  return rest as EditorNode;
}

export function listComponentMasters(nodes: Record<string, EditorNode>): EditorNode[] {
  return Object.values(nodes).filter(
    (n) => n.isComponent && (n.type === "frame" || n.type === "group"),
  );
}

export function componentMatchesSearchQuery(node: EditorNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.componentId?.toLowerCase().includes(q)) return true;
  const vp = node.variantProperties;
  if (vp) {
    for (const [key, val] of Object.entries(vp)) {
      if (key.toLowerCase().includes(q) || String(val).toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

export type ComponentLibraryGroup = {
  id: string;
  label: string;
  variants: EditorNode[];
};

/** Group variant siblings; standalone masters become single-item groups. */
export function groupComponentMasters(masters: EditorNode[]): ComponentLibraryGroup[] {
  const byVariantGroup = new Map<string, EditorNode[]>();
  const standalone: EditorNode[] = [];

  for (const m of masters) {
    if (m.variantGroupId) {
      const list = byVariantGroup.get(m.variantGroupId) ?? [];
      list.push(m);
      byVariantGroup.set(m.variantGroupId, list);
    } else {
      standalone.push(m);
    }
  }

  const groups: ComponentLibraryGroup[] = [];

  for (const [vgId, variants] of byVariantGroup) {
    const sortedVariants = [...variants].sort((a, b) =>
      variantSortKey(a).localeCompare(variantSortKey(b)),
    );
    const label = masterGroupLabel(sortedVariants);
    groups.push({ id: vgId, label, variants: sortedVariants });
  }

  for (const m of standalone) {
    groups.push({ id: m.id, label: m.name, variants: [m] });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

function variantSortKey(node: EditorNode): string {
  const vp = node.variantProperties;
  if (vp?.Variant != null) return String(vp.Variant);
  return node.name;
}

function masterGroupLabel(variants: EditorNode[]): string {
  if (variants.length === 0) return "Component";
  const first = variants[0]!;
  const base = first.name.replace(/\s*·\s*variant$/i, "").trim();
  return base || first.name;
}

export function filterComponentLibraryGroups(
  groups: ComponentLibraryGroup[],
  query: string,
): ComponentLibraryGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => {
      const labelMatch = g.label.toLowerCase().includes(q);
      const variants = labelMatch
        ? g.variants
        : g.variants.filter((m) => componentMatchesSearchQuery(m, q));
      return { ...g, variants };
    })
    .filter((g) => g.variants.length > 0);
}

export function flattenComponentLibraryGroups(groups: ComponentLibraryGroup[]): EditorNode[] {
  return groups.flatMap((g) => g.variants);
}

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

export function canCreateComponentFromSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length === 0) return false;
  if (tops.some((id) => findInstanceRoot(nodes, id))) return false;
  const parentId = nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => nodes[id]!.parentId === parentId)) return false;
  const root = nodes[tops[0]!]!;
  if (tops.length === 1 && root.isComponent) return false;
  return true;
}

/** Group multiple top-level siblings; returns new group id. */
export function groupNodesForComponent(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  topIds: string[],
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; groupId: string } | null {
  if (topIds.length < 2) return null;
  const parentId = nodes[topIds[0]!]!.parentId;
  if (!topIds.every((id) => nodes[id]!.parentId === parentId)) return null;

  const P = parentListKey(parentId);
  const pw = parentId ? worldRect(parentId, nodes) : { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of topIds) {
    const w = worldRect(id, nodes);
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }
  const gw = maxX - minX;
  const gh = maxY - minY;
  const nextNodes = { ...nodes };
  const nextOrder = { ...childOrder };
  const gid = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  nextNodes[gid] = {
    id: gid,
    parentId,
    type: "group",
    name: "Component",
    x: minX - pw.x,
    y: minY - pw.y,
    width: gw,
    height: gh,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
  for (const id of topIds) {
    const w = worldRect(id, nodes);
    const n = nextNodes[id]!;
    nextNodes[id] = {
      ...n,
      parentId: gid,
      x: w.x - minX,
      y: w.y - minY,
    };
  }
  const list = [...(nextOrder[P] ?? [])];
  const ixs = topIds.map((id) => list.indexOf(id)).sort((a, b) => a - b);
  const insertAt = ixs[0]!;
  const newList = list.filter((id) => !topIds.includes(id));
  newList.splice(insertAt, 0, gid);
  nextOrder[P] = newList;
  nextOrder[gid] = topIds;
  return { nodes: nextNodes, childOrder: nextOrder, groupId: gid };
}

/** Wrap a single shape in a frame so it can become a component root. */
export function wrapNodeInFrameForComponent(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; frameId: string } | null {
  const n = nodes[nodeId];
  if (!n) return null;
  if (n.type === "frame" || n.type === "group") {
    return { nodes, childOrder, frameId: nodeId };
  }

  const parentId = n.parentId;
  const P = parentListKey(parentId);
  const fid = `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nextNodes = { ...nodes };
  const nextOrder = { ...childOrder };

  nextNodes[fid] = {
    id: fid,
    parentId,
    type: "frame",
    name: n.name || "Component",
    x: n.x,
    y: n.y,
    width: Math.max(1, n.width),
    height: Math.max(1, n.height),
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    fillEnabled: true,
  };
  nextNodes[nodeId] = {
    ...n,
    parentId: fid,
    x: 0,
    y: 0,
  };

  const list = [...(nextOrder[P] ?? [])];
  const idx = list.indexOf(nodeId);
  if (idx >= 0) {
    list.splice(idx, 1, fid);
    nextOrder[P] = list;
  }
  nextOrder[fid] = [nodeId];

  return { nodes: nextNodes, childOrder: nextOrder, frameId: fid };
}

export function markNodeAsComponent(
  nodes: Record<string, EditorNode>,
  rootId: string,
): Record<string, EditorNode> {
  const n = nodes[rootId];
  if (!n || (n.type !== "frame" && n.type !== "group")) return nodes;
  const cmpId = newComponentId();
  const vg = newVariantGroupId();
  return {
    ...nodes,
    [rootId]: {
      ...n,
      isComponent: true,
      componentId: cmpId,
      variantGroupId: vg,
      variantProperties: n.variantProperties ?? { Variant: "Default" },
    },
  };
}

export function resolveMasterRootId(
  nodes: Record<string, EditorNode>,
  componentKey: string,
): string | null {
  const byId = nodes[componentKey];
  if (byId?.isComponent && (byId.type === "frame" || byId.type === "group")) return componentKey;
  for (const n of Object.values(nodes)) {
    if (n.isComponent && n.componentId === componentKey && (n.type === "frame" || n.type === "group")) {
      return n.id;
    }
  }
  return null;
}

export function cloneEditorSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sourceRootId: string,
  newParentId: string | null,
  rootListKey: string,
  mapNewRoot: (clonedRoot: EditorNode, idMap: Map<string, string>) => EditorNode,
  mapClonedNode?: (oldNode: EditorNode, newNode: EditorNode, idMap: Map<string, string>) => EditorNode,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  const sourceRoot = nodes[sourceRootId];
  if (!sourceRoot) return null;
  const nextNodes: Record<string, EditorNode> = { ...nodes };
  const nextOrder: Record<string, string[]> = { ...childOrder };
  const idMap = new Map<string, string>();

  const cloneRec = (oldId: string, parentNewId: string | null): string => {
    const old = nodes[oldId];
    if (!old) return "";
    const newId = `${old.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    idMap.set(oldId, newId);
    let fresh: EditorNode = {
      ...old,
      id: newId,
      parentId: parentNewId,
    };
    if (mapClonedNode) fresh = mapClonedNode(old, fresh, idMap);
    nextNodes[newId] = fresh;
    const kids = [...(childOrder[oldId] ?? [])];
    const nk: string[] = [];
    for (const k of kids) nk.push(cloneRec(k, newId));
    nextOrder[newId] = nk;
    return newId;
  };

  const newRootId = cloneRec(sourceRootId, newParentId);
  const mappedRoot = mapNewRoot(nextNodes[newRootId]!, idMap);
  nextNodes[newRootId] = mappedRoot;

  const list = [...(nextOrder[rootListKey] ?? [])].filter((x) => x !== newRootId);
  list.push(newRootId);
  nextOrder[rootListKey] = list;

  return { nodes: nextNodes, childOrder: nextOrder, newRootId };
}

/** Merge instance overrides into subtree nodes and strip instance metadata. */
export function detachInstanceTree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): Record<string, EditorNode> | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const ids = collectSubtreeIds(instanceRootId, childOrder);
  const out = { ...nodes };
  const ovs = root.instanceOverrides ?? {};
  for (const tid of ids) {
    const base = out[tid]!;
    const raw = ovs[tid];
    const patch =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as InstanceOverridePatch) : {};
    const next: EditorNode = {
      ...base,
      ...patch,
      sourceComponentId: undefined,
      instanceOverrides: undefined,
    };
    if (tid === instanceRootId) {
      next.isComponent = undefined;
      next.componentId = undefined;
      next.variantGroupId = undefined;
      next.variantProperties = undefined;
    }
    out[tid] = next;
  }
  return out;
}
