import type { DomSnapshotNode } from "@/lib/webImport/types";

const STORYBOOK_PREVIEW_CLASS = "sb-pml-preview-canvas";
const STORYBOOK_HOST_CLASSES = [
  "sb-pml-storybook-phone-host",
  "sb-pml-bottom-sheet-host",
  "pml-theme-scope",
];

const COMPONENT_CLASS_HINT =
  /\b(btn|badge|list-item|listitem|chip|avatar|input-field|checkbox|radio|toggle|tab|card|banner|toast|alert|loading|icon)\b/;

function shiftDomTree(node: DomSnapshotNode, dx: number, dy: number): DomSnapshotNode {
  return {
    ...node,
    rect: {
      ...node.rect,
      x: node.rect.x - dx,
      y: node.rect.y - dy,
    },
    children: node.children.map((child) => shiftDomTree(child, dx, dy)),
  };
}

function descendantContentBounds(node: DomSnapshotNode): {
  width: number;
  height: number;
} {
  let maxX = node.rect.x + node.rect.width;
  let maxY = node.rect.y + node.rect.height;
  const walk = (n: DomSnapshotNode) => {
    maxX = Math.max(maxX, n.rect.x + n.rect.width);
    maxY = Math.max(maxY, n.rect.y + n.rect.height);
    for (const child of n.children) walk(child);
  };
  walk(node);
  return {
    width: Math.max(1, Math.round(maxX - node.rect.x)),
    height: Math.max(1, Math.round(maxY - node.rect.y)),
  };
}

function findPreviewCanvas(root: DomSnapshotNode): DomSnapshotNode | null {
  let found: DomSnapshotNode | null = null;
  const walk = (node: DomSnapshotNode) => {
    const cls = node.className ?? "";
    if (cls.includes(STORYBOOK_PREVIEW_CLASS) || cls.includes("sb-show-main")) {
      found = node;
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return found;
}

function isComponentRootCandidate(node: DomSnapshotNode): boolean {
  const tag = node.tagName.toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  if (tag === "button" || tag === "input" || tag === "textarea" || tag === "select") return true;
  if (COMPONENT_CLASS_HINT.test(cls)) return true;
  if (node.componentHint === "button" || node.componentHint === "input") return true;
  return false;
}

function scoreComponentCandidate(node: DomSnapshotNode): number {
  const area = node.rect.width * node.rect.height;
  if (area < 1) return 0;
  if (node.rect.width > 720 || node.rect.height > 480) return 0;

  let score = 1_000_000 - area;
  const tag = node.tagName.toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  if (tag === "button" || tag === "input") score += 500_000;
  if (cls.includes("btn") || cls.includes("badge")) score += 400_000;
  if (COMPONENT_CLASS_HINT.test(cls)) score += 200_000;
  return score;
}

function findBestComponentRoot(start: DomSnapshotNode): DomSnapshotNode | null {
  let best: DomSnapshotNode | null = null;
  let bestScore = 0;

  const walk = (node: DomSnapshotNode, depth: number) => {
    if (isComponentRootCandidate(node)) {
      const score = scoreComponentCandidate(node);
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    if (depth < 14) {
      for (const child of node.children) walk(child, depth + 1);
    }
  };
  walk(start, 0);
  return best;
}

/** Descend through Storybook preview wrappers (phone host, theme scope) when they add chrome only. */
function unwrapStorybookDecorators(node: DomSnapshotNode): DomSnapshotNode {
  let cur = node;
  for (let i = 0; i < 6; i++) {
    const cls = cur.className ?? "";
    const isHost =
      STORYBOOK_HOST_CLASSES.some((token) => cls.includes(token)) ||
      cls.includes(STORYBOOK_PREVIEW_CLASS);
    if (!isHost || cur.children.length !== 1) break;
    cur = cur.children[0]!;
  }
  return cur;
}

/**
 * Re-root Storybook iframe captures on the rendered component (button, badge, …),
 * not the preview canvas / phone host wrapper.
 */
export function focusDomTreeOnStorybookStoryRoot(root: DomSnapshotNode): DomSnapshotNode {
  const preview = findPreviewCanvas(root) ?? root;
  const unwrapped = unwrapStorybookDecorators(preview);
  const component = findBestComponentRoot(unwrapped) ?? findBestComponentRoot(preview);
  const target = component ?? unwrapped;

  const shifted = shiftDomTree(target, target.rect.x, target.rect.y);
  const bounds = descendantContentBounds(shifted);
  return {
    ...shifted,
    rect: {
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    },
  };
}
