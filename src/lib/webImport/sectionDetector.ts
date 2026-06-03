import type { DetectedSection, DomSnapshotNode } from "@/lib/webImport/types";

function tagSectionHint(tag: string, rect: DomSnapshotNode["rect"]): DomSnapshotNode["sectionHint"] {
  const t = tag.toLowerCase();
  if (t === "header") return "header";
  if (t === "nav") return "nav";
  if (t === "footer") return "footer";
  if (t === "form") return "form";
  if (t === "main" || t === "article") return "content";
  if (rect.y < 120 && rect.height < 200) return "header";
  if (rect.height > 400 && rect.width > 600) return "hero";
  return "content";
}

export function annotateSectionHints(root: DomSnapshotNode): DomSnapshotNode {
  const walk = (node: DomSnapshotNode, depth: number): DomSnapshotNode => {
    let sectionHint = node.sectionHint;
    if (!sectionHint && depth <= 3 && ["div", "section", "main", "article", "header", "footer", "nav"].includes(node.tagName)) {
      sectionHint = tagSectionHint(node.tagName, node.rect);
    }
  const children = node.children.map((c) => walk(c, depth + 1));
    return { ...node, sectionHint, children };
  };
  return walk(root, 0);
}

export function detectSections(root: DomSnapshotNode): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const walk = (node: DomSnapshotNode) => {
    if (node.sectionHint && node.children.length > 0) {
      sections.push({
        id: `sec-${node.id}`,
        kind: node.sectionHint,
        name: node.sectionHint.charAt(0).toUpperCase() + node.sectionHint.slice(1),
        nodeIds: [node.id],
      });
    }
    node.children.forEach(walk);
  };
  walk(root);
  return sections;
}
