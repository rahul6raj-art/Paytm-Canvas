import type { DomSnapshotNode } from "@/lib/webImport/types";

const SKIP_TAGS = new Set([
  "script",
  "style",
  "meta",
  "link",
  "noscript",
  "head",
  "template",
  "br",
  "wbr",
]);

export function isVisibleSnapshotNode(node: DomSnapshotNode): boolean {
  if (SKIP_TAGS.has(node.tagName)) return false;
  const { width, height } = node.rect;
  if (width < 1 || height < 1) return false;
  const opacity = parseFloat(node.styles.opacity ?? "1");
  if (!Number.isFinite(opacity) || opacity < 0.05) return false;
  const display = (node.styles.display ?? "").toLowerCase();
  if (display === "none" || display === "contents") return false;
  const visibility = (node.styles as { visibility?: string }).visibility?.toLowerCase?.();
  if (visibility === "hidden" || visibility === "collapse") return false;
  return true;
}

export function filterDomSnapshotTree(root: DomSnapshotNode): DomSnapshotNode | null {
  const walk = (node: DomSnapshotNode): DomSnapshotNode | null => {
    if (SKIP_TAGS.has(node.tagName)) return null;
    if (!isVisibleSnapshotNode(node) && node.children.length === 0) return null;

    const children: DomSnapshotNode[] = [];
    for (const child of node.children) {
      const kept = walk(child);
      if (kept) children.push(kept);
    }

    if (!isVisibleSnapshotNode(node) && children.length === 0) return null;

    return { ...node, children };
  };

  return walk(root);
}

export function countDomNodes(root: DomSnapshotNode): number {
  let n = 1;
  for (const c of root.children) n += countDomNodes(c);
  return n;
}

export function pruneDomTreeByLimit(root: DomSnapshotNode, maxNodes: number): DomSnapshotNode {
  let count = 0;
  const walk = (node: DomSnapshotNode): DomSnapshotNode | null => {
    if (count >= maxNodes) return null;
    count += 1;
    const children: DomSnapshotNode[] = [];
    for (const child of node.children) {
      if (count >= maxNodes) break;
      const kept = walk(child);
      if (kept) children.push(kept);
    }
    return { ...node, children };
  };
  return walk(root) ?? { ...root, children: [] };
}
