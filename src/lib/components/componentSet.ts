import type { EditorNode } from "@/stores/useEditorStore";
import {
  cloneEditorSubtree,
  listComponentMasters,
  newVariantGroupId,
  stripComponentFields,
} from "@/lib/componentModel";
import { applyAutoLayoutToContainer } from "@/lib/autoLayoutSelection";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { componentDisplayName, componentFolderPath } from "@/lib/components/folders";
import { nextVariantMasterPosition } from "@/lib/componentUx";
import { worldRect } from "@/lib/tree";

export type ComponentSetProperty = {
  name: string;
  values: string[];
};

export type ComponentSetVariant = {
  componentId: string;
  values: Record<string, string>;
};

export type ComponentSet = {
  id: string;
  name: string;
  properties: ComponentSetProperty[];
  variants: ComponentSetVariant[];
};

export function findComponentSetContainer(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
): EditorNode | undefined {
  return Object.values(nodes).find(
    (n) => n.isComponentSet && n.variantGroupId === variantGroupId,
  );
}

export function isComponentSetContainerNode(node: EditorNode | undefined): boolean {
  return Boolean(node?.isComponentSet);
}

/** Enable/reflow horizontal auto-layout on a component set (gap handles, swap, group drag). */
export function reflowComponentSetContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  setContainerId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const result = applyAutoLayoutToContainer(nodes, childOrder, setContainerId);
  if (!result) return { nodes, childOrder };
  return { nodes: result.nodes, childOrder: result.childOrder };
}

/** Figma: variant frames inside a set do not get their own canvas title. */
export function isVariantMasterInComponentSet(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): boolean {
  const node = nodes[nodeId];
  if (!node?.isComponent || !node.variantGroupId) return false;
  const container = findComponentSetContainer(nodes, node.variantGroupId);
  if (!container) return false;
  const variantCount = listComponentMasters(nodes).filter(
    (m) => m.variantGroupId === node.variantGroupId,
  ).length;
  return variantCount > 1 && node.parentId === container.id;
}

/** Whether a node lives inside a component set subtree (set container, variants, and their children). */
export function isInsideComponentSet(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): boolean {
  let cur: string | null = nodeId;
  while (cur) {
    const n: EditorNode | undefined = nodes[cur];
    if (!n) return false;
    if (n.isComponentSet) return true;
    cur = n.parentId;
  }
  return false;
}

/** Whether a frame should show a generic canvas title (RootFrameLabels). */
export function shouldShowCanvasFrameLabel(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): boolean {
  const node = nodes[nodeId];
  if (!node || node.type !== "frame") return false;
  if (node.isComponentSet) return false;
  if (isVariantMasterInComponentSet(nodes, nodeId)) return false;
  return true;
}

/** Expand the set container to fit all variant children (local coordinates). */
export function fitComponentSetContainerBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  setContainerId: string,
): Record<string, EditorNode> {
  const container = nodes[setContainerId];
  if (!container?.isComponentSet) return nodes;

  const childIds = childOrder[setContainerId] ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cid of childIds) {
    const c = nodes[cid];
    if (!c) continue;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  if (!Number.isFinite(minX)) return nodes;

  let next = { ...nodes };
  if (minX !== 0 || minY !== 0) {
    for (const cid of childIds) {
      const c = next[cid];
      if (!c) continue;
      next[cid] = { ...c, x: c.x - minX, y: c.y - minY };
    }
    next[setContainerId] = {
      ...container,
      x: container.x + minX,
      y: container.y + minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  } else {
    next[setContainerId] = {
      ...container,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }
  return next;
}

const DEFAULT_PROPERTY_NAMES = ["Variant", "Size", "State"] as const;

function normalizeMasterName(name: string): string {
  return name.replace(/\s*·\s*variant$/i, "").trim();
}

/** Figma-style auto name for component sets without a shared slash prefix (Component 1, Component 2, …). */
export function nextComponentSetName(nodes: Record<string, EditorNode>): string {
  const used = new Set<number>();
  const re = /^Component\s+(\d+)$/i;
  for (const n of Object.values(nodes)) {
    if (!n?.isComponentSet) continue;
    const match = re.exec(n.name.trim());
    if (match) used.add(Number.parseInt(match[1]!, 10));
  }
  let index = 1;
  while (used.has(index)) index++;
  return `Component ${index}`;
}

function sharedNamePrefixLength(masterNames: string[]): number {
  const paths = masterNames.map((name) => componentFolderPath(normalizeMasterName(name)));
  if (paths.length === 0) return 0;
  let commonLen = paths[0]!.length;
  for (let i = 0; i < commonLen; i++) {
    const seg = paths[0]![i];
    if (!paths.every((p) => p[i] === seg)) {
      commonLen = i;
      break;
    }
  }
  return commonLen;
}

/** Set container label: shared slash prefix when present, otherwise Component N. */
export function resolveComponentSetContainerName(
  nodes: Record<string, EditorNode>,
  masterNames: string[],
): string {
  const inferred = inferVariantAxesFromNames(masterNames);
  if (sharedNamePrefixLength(masterNames) > 0) return inferred.setName;
  return nextComponentSetName(nodes);
}

/** Infer variant property axes from slash-separated component names. */
export function inferVariantAxesFromNames(
  masterNames: string[],
): { setName: string; properties: ComponentSetProperty[]; assignments: Record<string, string>[] } {
  const paths = masterNames.map((name) => componentFolderPath(normalizeMasterName(name)));
  if (paths.length === 0) {
    return { setName: "Component", properties: [], assignments: [] };
  }

  let commonLen = paths[0]!.length;
  for (let i = 0; i < commonLen; i++) {
    const seg = paths[0]![i];
    if (!paths.every((p) => p[i] === seg)) {
      commonLen = i;
      break;
    }
  }

  const setName = paths[0]!.slice(0, commonLen).join("/") || paths[0]![0] || "Component";
  const suffixes = paths.map((p) => p.slice(commonLen));

  if (suffixes.every((s) => s.length === 0)) {
    const values = masterNames.map((n, i) => componentDisplayName(normalizeMasterName(n)) || `Variant ${i + 1}`);
    return {
      setName,
      properties: [{ name: "Variant", values: [...new Set(values)] }],
      assignments: values.map((v) => ({ Variant: v })),
    };
  }

  const maxSuffixLen = Math.max(...suffixes.map((s) => s.length));

  if (maxSuffixLen === 1 || suffixes.every((s) => s.length === 1)) {
    const values = suffixes.map((s) => s[0] ?? "Default");
    return {
      setName,
      properties: [{ name: "Variant", values: [...new Set(values)] }],
      assignments: values.map((v) => ({ Variant: v })),
    };
  }

  if (!suffixes.every((s) => s.length === maxSuffixLen)) {
    const values = suffixes.map((s) => s[s.length - 1] ?? componentDisplayName(paths[0]!.join("/")));
    return {
      setName,
      properties: [{ name: "Variant", values: [...new Set(values)] }],
      assignments: values.map((v) => ({ Variant: v })),
    };
  }

  const properties: ComponentSetProperty[] = [];
  for (let i = 0; i < maxSuffixLen; i++) {
    const values = [...new Set(suffixes.map((s) => s[i]!))];
    if (values.length <= 1) continue;
    const name = DEFAULT_PROPERTY_NAMES[i] ?? `Property ${i + 1}`;
    properties.push({ name, values });
  }

  if (properties.length === 0) {
    const values = suffixes.map((s) => s[s.length - 1]!);
    return {
      setName,
      properties: [{ name: "Variant", values: [...new Set(values)] }],
      assignments: values.map((v) => ({ Variant: v })),
    };
  }

  const assignments = suffixes.map((suffix) => {
    const out: Record<string, string> = {};
    let propIdx = 0;
    for (let i = 0; i < maxSuffixLen; i++) {
      const values = [...new Set(suffixes.map((s) => s[i]!))];
      if (values.length <= 1) continue;
      const name = DEFAULT_PROPERTY_NAMES[propIdx] ?? `Property ${propIdx + 1}`;
      out[name] = suffix[i]!;
      propIdx++;
    }
    return out;
  });

  return { setName, properties, assignments };
}

export function buildComponentSet(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
): ComponentSet | null {
  const masters = listComponentMasters(nodes).filter((m) => m.variantGroupId === variantGroupId);
  if (masters.length === 0) return null;

  const inferred = inferVariantAxesFromNames(masters.map((m) => m.name));
  const container = findComponentSetContainer(nodes, variantGroupId);
  const propertyMap = new Map<string, Set<string>>();

  for (const m of masters) {
    for (const [key, val] of Object.entries(m.variantProperties ?? {})) {
      const set = propertyMap.get(key) ?? new Set<string>();
      set.add(val);
      propertyMap.set(key, set);
    }
  }

  const properties: ComponentSetProperty[] =
    propertyMap.size > 0
      ? [...propertyMap.entries()].map(([name, values]) => ({
          name,
          values: [...values].sort((a, b) => a.localeCompare(b)),
        }))
      : inferred.properties;

  const variants: ComponentSetVariant[] = masters.map((m) => ({
    componentId: m.id,
    values: { ...(m.variantProperties ?? {}) },
  }));

  return {
    id: variantGroupId,
    name: container?.name ?? inferred.setName,
    properties,
    variants,
  };
}

export function resolveVariantMasterIdWithFallback(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  selectedVariant: Record<string, string> | undefined,
  fallbackMasterId: string,
): string {
  if (!selectedVariant || Object.keys(selectedVariant).length === 0) return fallbackMasterId;

  const masters = listComponentMasters(nodes).filter((m) => m.variantGroupId === variantGroupId);
  if (masters.length === 0) return fallbackMasterId;

  for (const m of masters) {
    const vp = m.variantProperties ?? {};
    if (Object.entries(selectedVariant).every(([k, v]) => vp[k] === v)) return m.id;
  }

  let bestId = fallbackMasterId;
  let bestScore = -1;
  for (const m of masters) {
    const vp = m.variantProperties ?? {};
    let score = 0;
    for (const [k, v] of Object.entries(selectedVariant)) {
      if (vp[k] === v) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = m.id;
    }
  }
  return bestScore > 0 ? bestId : fallbackMasterId;
}

/** Align stable layer ids on target variant to match reference variant subtree structure. */
export function alignVariantStableIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  referenceMasterId: string,
  targetMasterId: string,
): Record<string, EditorNode> {
  const refMaster = nodes[referenceMasterId];
  const tgtMaster = nodes[targetMasterId];
  if (!refMaster?.componentLayerStableIds || !tgtMaster?.isComponent) return nodes;

  const refStable = refMaster.componentLayerStableIds;
  const aligned: Record<string, string> = {};

  const walk = (refId: string, tgtId: string) => {
    const sid = refStable[refId];
    if (sid) aligned[tgtId] = sid;
    const refKids = childOrder[refId] ?? [];
    const tgtKids = childOrder[tgtId] ?? [];
    const len = Math.min(refKids.length, tgtKids.length);
    for (let i = 0; i < len; i++) walk(refKids[i]!, tgtKids[i]!);
  };
  walk(referenceMasterId, targetMasterId);

  return {
    ...nodes,
    [targetMasterId]: { ...tgtMaster, componentLayerStableIds: aligned },
  };
}

export function alignAllVariantsToReference(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterIds: string[],
): Record<string, EditorNode> {
  if (masterIds.length < 2) return nodes;
  const referenceId = masterIds[0]!;
  let next = { ...nodes };
  for (let i = 1; i < masterIds.length; i++) {
    next = alignVariantStableIds(next, childOrder, referenceId, masterIds[i]!);
  }
  return next;
}

export function combineMastersAsVariantSet(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterIds: string[],
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  setContainerId: string;
} | null {
  if (masterIds.length < 2) return null;

  const masters = masterIds.map((id) => nodes[id]).filter(Boolean);
  if (masters.length !== masterIds.length) return null;
  if (!masters.every((m) => m.isComponent && (m.type === "frame" || m.type === "group"))) return null;

  const parentId = masters[0]!.parentId;
  if (!masters.every((m) => m.parentId === parentId)) return null;

  const vg = newVariantGroupId();
  const { assignments } = inferVariantAxesFromNames(masters.map((m) => m.name));
  const setContainerName = resolveComponentSetContainerName(nodes, masters.map((m) => m.name));

  const P = parentListKey(parentId);
  const pw = parentId ? worldRect(parentId, nodes) : { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of masterIds) {
    const w = worldRect(id, nodes);
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }

  const setContainerId = `component-set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let next = { ...nodes };
  let nextOrder = { ...childOrder };

  next[setContainerId] = {
    id: setContainerId,
    parentId,
    type: "frame",
    name: setContainerName,
    x: minX - pw.x,
    y: minY - pw.y,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
    isComponentSet: true,
    variantGroupId: vg,
  };

  for (let i = 0; i < masterIds.length; i++) {
    const id = masterIds[i]!;
    const w = worldRect(id, nodes);
    const n = next[id]!;
    const props = { ...(n.variantProperties ?? {}), ...assignments[i]! };
    next[id] = {
      ...n,
      parentId: setContainerId,
      x: w.x - minX,
      y: w.y - minY,
      variantGroupId: vg,
      variantProperties: props,
    };
  }

  const list = [...(nextOrder[P] ?? [])];
  const ixs = masterIds.map((id) => list.indexOf(id)).sort((a, b) => a - b);
  const insertAt = ixs[0]!;
  const newList = list.filter((id) => !masterIds.includes(id));
  newList.splice(insertAt, 0, setContainerId);
  nextOrder[P] = newList;
  nextOrder[setContainerId] = masterIds;

  next = alignAllVariantsToReference(next, nextOrder, masterIds);
  next = fitComponentSetContainerBounds(next, nextOrder, setContainerId);
  const reflowed = reflowComponentSetContainer(next, nextOrder, setContainerId);
  next = reflowed.nodes;
  nextOrder = reflowed.childOrder;
  return { nodes: next, childOrder: nextOrder, setContainerId: setContainerId };
}

export function variantAxesFromSet(set: ComponentSet): string[] {
  return set.properties.map((p) => p.name);
}

export function variantValuesForSetProperty(set: ComponentSet, axis: string): string[] {
  const prop = set.properties.find((p) => p.name === axis);
  return prop?.values ?? [];
}

export function addPropertyToSet(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  propertyName: string,
  defaultValue: string,
): Record<string, EditorNode> | null {
  const masters = listComponentMasters(nodes).filter((m) => m.variantGroupId === variantGroupId);
  if (masters.length === 0) return null;

  let next = { ...nodes };
  for (const m of masters) {
    if (m.variantProperties?.[propertyName] != null) continue;
    next[m.id] = {
      ...m,
      variantProperties: { ...(m.variantProperties ?? {}), [propertyName]: defaultValue },
    };
  }
  return next;
}

export function renamePropertyInSet(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  oldName: string,
  newName: string,
): Record<string, EditorNode> | null {
  if (oldName === newName || !oldName.trim() || !newName.trim()) return null;
  const masters = listComponentMasters(nodes).filter((m) => m.variantGroupId === variantGroupId);
  if (masters.length === 0) return null;

  let next = { ...nodes };
  for (const m of masters) {
    const vp = m.variantProperties ?? {};
    if (!(oldName in vp)) continue;
    const { [oldName]: val, ...rest } = vp;
    next[m.id] = {
      ...m,
      variantProperties: { ...rest, [newName]: val! },
    };
  }
  return next;
}

export function deletePropertyFromSet(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  propertyName: string,
): Record<string, EditorNode> | null {
  const masters = listComponentMasters(nodes).filter((m) => m.variantGroupId === variantGroupId);
  if (masters.length === 0) return null;

  let next = { ...nodes };
  for (const m of masters) {
    const vp = { ...(m.variantProperties ?? {}) };
    if (!(propertyName in vp)) continue;
    delete vp[propertyName];
    next[m.id] = { ...m, variantProperties: vp };
  }
  return next;
}

export function updateVariantPropertyValue(
  nodes: Record<string, EditorNode>,
  masterId: string,
  axis: string,
  value: string,
): Record<string, EditorNode> | null {
  const m = nodes[masterId];
  if (!m?.isComponent || !m.variantGroupId) return null;
  return {
    ...nodes,
    [masterId]: {
      ...m,
      variantProperties: { ...(m.variantProperties ?? {}), [axis]: value },
    },
  };
}

export function deleteVariantMaster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } | null {
  const master = nodes[masterId];
  if (!master?.isComponent || !master.variantGroupId) return null;

  const siblings = listComponentMasters(nodes).filter((m) => m.variantGroupId === master.variantGroupId);
  if (siblings.length <= 1) return null;

  let nextNodes = { ...nodes };
  const nextOrder = { ...childOrder };
  const ids = collectSubtreeIds(masterId, childOrder);
  for (const id of ids) delete nextNodes[id];

  const parentKey = master.parentId ?? EDITOR_ROOT_KEY;
  nextOrder[parentKey] = (nextOrder[parentKey] ?? []).filter((id) => !ids.includes(id));
  for (const id of ids) delete nextOrder[id];

  const setContainer = findComponentSetContainer(nextNodes, master.variantGroupId);
  if (setContainer) {
    nextNodes = fitComponentSetContainerBounds(nextNodes, nextOrder, setContainer.id);
    const reflowed = reflowComponentSetContainer(nextNodes, nextOrder, setContainer.id);
    nextNodes = reflowed.nodes;
  }

  return { nodes: nextNodes, childOrder: nextOrder };
}

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

export function cloneVariantMasterInSet(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sourceMasterId: string,
  options?: { suffixVariantLabel?: boolean },
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newMasterId: string } | null {
  const source = nodes[sourceMasterId];
  if (!source?.isComponent || !source.variantGroupId) return null;

  const vg = source.variantGroupId;
  const vp = { ...(source.variantProperties ?? {}) };
  if (options?.suffixVariantLabel !== false) {
    const axis = "Variant";
    if (vp[axis]) {
      let n = 2;
      while (
        Object.values(nodes).some(
          (x) => x.variantGroupId === vg && x.variantProperties?.[axis] === `${vp[axis]} Copy ${n}`,
        )
      ) {
        n++;
      }
      vp[axis] = `${vp[axis]} Copy ${n}`;
    }
  }

  const pos = nextVariantMasterPosition(nodes, vg, source);
  const res = cloneEditorSubtree(
    nodes,
    childOrder,
    sourceMasterId,
    source.parentId,
    parentListKey(source.parentId),
    (root) => ({
      ...root,
      isComponent: true,
      componentId: source.componentId,
      variantGroupId: vg,
      variantProperties: vp,
      x: pos.x,
      y: pos.y,
      name: source.name,
    }),
    (old, fresh) => {
      let next = stripComponentFields(fresh);
      if (old.id === sourceMasterId) {
        next = { ...next, x: pos.x, y: pos.y };
      }
      return next;
    },
  );
  if (!res) return null;

  let nextNodes = res.nodes;
  nextNodes = alignVariantStableIds(nextNodes, res.childOrder, sourceMasterId, res.newRootId);
  nextNodes = {
    ...nextNodes,
    [res.newRootId]: {
      ...nextNodes[res.newRootId]!,
      componentVersion: source.componentVersion ?? 1,
    },
  };

  const setContainer = findComponentSetContainer(nextNodes, vg);
  if (setContainer) {
    nextNodes = fitComponentSetContainerBounds(nextNodes, res.childOrder, setContainer.id);
    const reflowed = reflowComponentSetContainer(nextNodes, res.childOrder, setContainer.id);
    nextNodes = reflowed.nodes;
  }

  return { nodes: nextNodes, childOrder: res.childOrder, newMasterId: res.newRootId };
}

export function duplicateVariantMaster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sourceMasterId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newMasterId: string } | null {
  return cloneVariantMasterInSet(nodes, childOrder, sourceMasterId, { suffixVariantLabel: true });
}

export function addVariantForPropertyValue(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sourceMasterId: string,
  propertyName: string,
  propertyValue: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newMasterId: string } | null {
  const dup = cloneVariantMasterInSet(nodes, childOrder, sourceMasterId, { suffixVariantLabel: false });
  if (!dup) return null;
  const nextNodes = updateVariantPropertyValue(dup.nodes, dup.newMasterId, propertyName, propertyValue);
  if (!nextNodes) return null;
  return { nodes: nextNodes, childOrder: dup.childOrder, newMasterId: dup.newMasterId };
}
