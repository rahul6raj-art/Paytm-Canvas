export type NodeMin = { parentId: string | null; name: string };

export function isAncestorOf(
  nodes: Record<string, NodeMin>,
  ancestorId: string,
  nodeId: string,
): boolean {
  let cur: string | null = nodeId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

export function topLevelSelectedIds(selectedIds: string[], nodes: Record<string, NodeMin>): string[] {
  return selectedIds.filter((id) => !selectedIds.some((o) => o !== id && isAncestorOf(nodes, o, id)));
}

export function collectSubtreeIds(rootId: string, childOrder: Record<string, string[]>): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const c of childOrder[id] ?? []) walk(c);
  };
  walk(rootId);
  return out;
}

export function nextFrameName(nodes: Record<string, { name: string }>): string {
  let max = 0;
  const re = /^Frame (\d+)$/;
  for (const n of Object.values(nodes)) {
    const m = re.exec(n.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Frame ${max + 1}`;
}

export function nextCopyName(nodes: Record<string, { name: string }>, base: string): string {
  if (!nodesHasName(nodes, `${base} Copy`)) return `${base} Copy`;
  let i = 2;
  while (nodesHasName(nodes, `${base} Copy ${i}`)) i++;
  return `${base} Copy ${i}`;
}

/** Duplicate root label: "Copy", "Copy 2", … (unique in the document). */
export function nextDuplicateName(nodes: Record<string, { name: string }>): string {
  if (!nodesHasName(nodes, "Copy")) return "Copy";
  let i = 2;
  while (nodesHasName(nodes, `Copy ${i}`)) i++;
  return `Copy ${i}`;
}

function nodesHasName(nodes: Record<string, { name: string }>, name: string): boolean {
  return Object.values(nodes).some((n) => n.name === name);
}
