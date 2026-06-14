import { newComponentId } from "@/lib/componentModel";
import type { DesignNode, DomSnapshotNode } from "@/lib/webImport/types";

const BUTTON_TAGS = new Set(["button"]);
const INPUT_TAGS = new Set(["input", "textarea", "select"]);
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "a", "li"]);

/** Annotate raw DOM snapshot nodes with coarse component hints. */
export function annotateComponentHints(root: DomSnapshotNode): DomSnapshotNode {
  const walk = (node: DomSnapshotNode): DomSnapshotNode => {
    let componentHint = node.componentHint;
    const tag = node.tagName.toLowerCase();

    if (!componentHint) {
      if (BUTTON_TAGS.has(tag) || (tag === "a" && node.text)) componentHint = "button";
      else if (INPUT_TAGS.has(tag)) componentHint = "input";
      else if (tag === "img") componentHint = "image";
      else if (TEXT_TAGS.has(tag) && node.text) componentHint = "text";
      else if (tag === "a") componentHint = "link";
      else if (
        node.styles.backgroundColor &&
        node.rect.width > 120 &&
        node.rect.height > 80 &&
        node.children.length >= 2
      ) {
        componentHint = "card";
      }
    }

    return {
      ...node,
      componentHint,
      children: node.children.map(walk),
    };
  };
  return walk(root);
}

export function componentSignature(node: DesignNode): string {
  const childSig = node.children
    .map((c) => `${c.role ?? c.tagName}:${Math.round(c.bounds.width)}x${Math.round(c.bounds.height)}`)
    .join("|");
  const layout = `${node.layout.kind}:${node.layout.layoutMode ?? "none"}`;
  const roundedW = Math.round(node.bounds.width / 8) * 8;
  const roundedH = Math.round(node.bounds.height / 8) * 8;
  return `${node.role ?? node.tagName}|${layout}|${roundedW}x${roundedH}|${childSig}`;
}

export function detectRepeatedComponents(root: DesignNode, minRepeats = 2): DesignNode {
  const buckets = new Map<string, DesignNode[]>();

  const walk = (node: DesignNode) => {
    if (node.children.length > 0 && (node.role === "card" || node.role === "list-item" || node.role === "button")) {
      const sig = componentSignature(node);
      node.componentSignature = sig;
      const list = buckets.get(sig) ?? [];
      list.push(node);
      buckets.set(sig, list);
    }
    node.children.forEach(walk);
  };
  walk(root);

  for (const [, group] of buckets) {
    if (group.length < minRepeats) continue;
    const master = group[0]!;
    const cmpId = newComponentId();
    master.isComponentMaster = true;
    master.componentId = cmpId;
    master.name = master.role ? `${master.role} component` : "Component";

    for (let i = 1; i < group.length; i++) {
      const inst = group[i]!;
      inst.sourceComponentId = `web-cmp-${cmpId}`;
      inst.children = [];
    }
  }

  return root;
}

export function annotateDomComponentHints(root: DomSnapshotNode): DomSnapshotNode {
  return annotateComponentHints(root);
}
