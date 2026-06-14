import type { DomSnapshotNode } from "@/lib/webImport/types";
import { isVisibleSnapshotNode } from "@/lib/webImport/domFilter";

const COLLAPSE_TAGS = new Set(["div", "section", "article", "main", "span"]);

function isStructuralWrapper(node: DomSnapshotNode): boolean {
  if (!COLLAPSE_TAGS.has(node.tagName.toLowerCase())) return false;
  if (node.text || node.src || node.svgMarkup) return false;
  const bg = node.styles.backgroundColor ?? "";
  const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
  const hasBorder = Boolean(node.styles.border && node.styles.border !== "none");
  const hasShadow = Boolean(node.styles.boxShadow && node.styles.boxShadow !== "none");
  const hasRadius = Boolean(node.styles.borderRadius && node.styles.borderRadius !== "0px");
  return !hasBg && !hasBorder && !hasShadow && !hasRadius;
}

function hasVisualChrome(node: DomSnapshotNode): boolean {
  const bg = node.styles.backgroundColor ?? "";
  const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
  const hasBorder = Boolean(
    parseFloat(node.styles.borderTopWidth ?? "0") > 0 ||
      (node.styles.boxShadow && node.styles.boxShadow !== "none"),
  );
  const hasRadius = Boolean(node.styles.borderRadius && node.styles.borderRadius !== "0px");
  const cls = (node.className ?? "").toLowerCase();
  return hasBg || hasBorder || hasRadius || /\brounded\b|\bborder\b|\bring\b/.test(cls);
}

/** Hoist real content out of 1px Tailwind divider wrappers (h-px) that swallow form fields. */
function skipCollapsedWrapper(
  node: DomSnapshotNode,
  children: DomSnapshotNode[],
): DomSnapshotNode | null {
  if (children.length !== 1 || node.rect.height > 4) return null;
  const only = children[0]!;
  if (only.rect.height > node.rect.height + 8) return only;
  return null;
}

/** Merge styled wrapper + native input into one importable field node. */
function tryMergeInputWrapper(
  parent: DomSnapshotNode,
  children: DomSnapshotNode[],
): DomSnapshotNode | null {
  if (children.length !== 1) return null;
  const only = children[0]!;
  const tag = only.tagName.toLowerCase();
  if (tag !== "input" && tag !== "textarea") return null;
  if (!hasVisualChrome(parent)) return null;
  const parentTag = parent.tagName.toLowerCase();
  if (!["div", "label", "form", "span"].includes(parentTag)) return null;

  return {
    ...only,
    id: parent.id,
    className: parent.className || only.className,
    rect: parent.rect,
    styles: { ...only.styles, ...pickChromeStyles(parent.styles) },
    placeholder: only.placeholder || parent.ariaLabel,
    ariaLabel: only.ariaLabel || parent.ariaLabel,
    children: [],
  };
}

function pickChromeStyles(
  styles: DomSnapshotNode["styles"],
): Partial<DomSnapshotNode["styles"]> {
  return {
    backgroundColor: styles.backgroundColor,
    backgroundImage: styles.backgroundImage,
    border: styles.border,
    borderTopWidth: styles.borderTopWidth,
    borderRightWidth: styles.borderRightWidth,
    borderBottomWidth: styles.borderBottomWidth,
    borderLeftWidth: styles.borderLeftWidth,
    borderTopColor: styles.borderTopColor,
    borderRightColor: styles.borderRightColor,
    borderBottomColor: styles.borderBottomColor,
    borderLeftColor: styles.borderLeftColor,
    borderRadius: styles.borderRadius,
    borderTopLeftRadius: styles.borderTopLeftRadius,
    borderTopRightRadius: styles.borderTopRightRadius,
    borderBottomRightRadius: styles.borderBottomRightRadius,
    borderBottomLeftRadius: styles.borderBottomLeftRadius,
    boxShadow: styles.boxShadow,
    outlineWidth: styles.outlineWidth,
    outlineColor: styles.outlineColor,
    outlineStyle: styles.outlineStyle,
    paddingTop: styles.paddingTop,
    paddingRight: styles.paddingRight,
    paddingBottom: styles.paddingBottom,
    paddingLeft: styles.paddingLeft,
  };
}

/** Collapse single-child wrappers and drop empty structural nodes. */
export function normalizeDomSnapshot(root: DomSnapshotNode): DomSnapshotNode {
  const walk = (node: DomSnapshotNode): DomSnapshotNode | null => {
    let children = node.children
      .map((c) => walk(c))
      .filter((c): c is DomSnapshotNode => c !== null);

    const mergedInput = tryMergeInputWrapper(node, children);
    if (mergedInput) return mergedInput;

    const collapsed = skipCollapsedWrapper(node, children);
    if (collapsed) return walk(collapsed);

    while (children.length === 1 && isStructuralWrapper(node)) {
      const only = children[0]!;
      const keepChildRect =
        ["input", "textarea", "button", "img", "svg"].includes(only.tagName.toLowerCase()) ||
        hasVisualChrome(only);
      node = {
        ...only,
        rect: keepChildRect ? only.rect : node.rect,
        sectionHint: node.sectionHint ?? only.sectionHint,
        className: node.className || only.className,
      };
      children = only.children;
    }

    if (!isVisibleSnapshotNode(node) && children.length === 0 && !node.text && !node.src) {
      return null;
    }

    return { ...node, children };
  };

  const out = walk(root);
  return out ?? { ...root, children: [] };
}
