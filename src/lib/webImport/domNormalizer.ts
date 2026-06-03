import type { DomSnapshotNode } from "@/lib/webImport/types";
import { isVisibleSnapshotNode } from "@/lib/webImport/domFilter";

/** Collapse single-child wrappers and drop empty structural nodes. */
export function normalizeDomSnapshot(root: DomSnapshotNode): DomSnapshotNode {
  const walk = (node: DomSnapshotNode): DomSnapshotNode | null => {
    let children = node.children
      .map((c) => walk(c))
      .filter((c): c is DomSnapshotNode => c !== null);

    if (
      children.length === 1 &&
      !node.text &&
      !node.src &&
      !node.svgMarkup &&
      ["div", "section", "article", "main"].includes(node.tagName)
    ) {
      const only = children[0]!;
      return {
        ...only,
        rect: node.rect,
        sectionHint: node.sectionHint ?? only.sectionHint,
      };
    }

    if (!isVisibleSnapshotNode(node) && children.length === 0 && !node.text) {
      return null;
    }

    return { ...node, children };
  };

  const out = walk(root);
  return out ?? { ...root, children: [] };
}
