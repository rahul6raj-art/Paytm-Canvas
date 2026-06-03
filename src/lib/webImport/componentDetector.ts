import type { DomSnapshotNode } from "@/lib/webImport/types";

const BUTTON_TAGS = new Set(["button"]);
const INPUT_TAGS = new Set(["input", "textarea", "select"]);
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "a", "li"]);

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
