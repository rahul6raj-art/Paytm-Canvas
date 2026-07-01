import type { DomSnapshotNode } from "@/lib/webImport/types";
import { pinPhoneShellBottomChromeInDomTree } from "@/lib/webImport/phoneShellBottomChrome";

/** Phone shell roots only — not `pml-home-section`, `pml-home-carousel`, etc. */
const SCREEN_ROOT_CLASS_TOKENS = new Set([
  "pml-home",
  "pml-signup",
  "pml-onboarding",
  "pml-more",
  "pml-stocks",
  "ob-flow",
]);

function isLikelyScreenRoot(node: DomSnapshotNode): boolean {
  const tokens = (node.className ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.some((t) => SCREEN_ROOT_CLASS_TOKENS.has(t.toLowerCase()))) return true;
  if (node.role === "main") return true;
  if (tokens.includes("data-craft-screen")) return true;
  return false;
}

function scoreScreenCandidate(
  node: DomSnapshotNode,
  viewport: { width: number; height: number },
): number {
  const { width, height } = node.rect;
  if (width < 280 || height < viewport.height * 0.75) return 0;
  let score = width * height;
  if (isLikelyScreenRoot(node)) score += 2_000_000;
  if (width >= 300 && width <= 420) score += 200_000;
  if (height >= viewport.height * 0.9) score += 100_000;
  return score;
}

function findBestScreenCandidate(
  root: DomSnapshotNode,
  viewport: { width: number; height: number },
): DomSnapshotNode | null {
  let best: DomSnapshotNode | null = null;
  let bestScore = 0;
  const walk = (node: DomSnapshotNode) => {
    const score = scoreScreenCandidate(node, viewport);
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return best;
}

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

function descendantContentHeight(node: DomSnapshotNode): number {
  let bottom = node.rect.y + node.rect.height;
  const walk = (n: DomSnapshotNode) => {
    bottom = Math.max(bottom, n.rect.y + n.rect.height);
    for (const child of n.children) walk(child);
  };
  walk(node);
  return Math.max(node.rect.height, bottom - node.rect.y);
}

function isScrollContainer(node: DomSnapshotNode): boolean {
  const cls = node.className ?? "";
  if (/__(?:scroll|main)\b/.test(cls)) return true;
  const overflow = (node.styles.overflow ?? "").toLowerCase();
  return overflow === "auto" || overflow === "scroll";
}

/** Expand scroll hosts so below-the-fold sections are laid out for capture. */
export function expandScrollContainersInDomTree(node: DomSnapshotNode): DomSnapshotNode {
  const children = node.children.map(expandScrollContainersInDomTree);
  const updated = { ...node, children };
  if (!isScrollContainer(updated)) return updated;

  let maxBottom = updated.rect.y + updated.rect.height;
  for (const child of children) {
    maxBottom = Math.max(maxBottom, child.rect.y + child.rect.height);
  }
  return {
    ...updated,
    rect: {
      ...updated.rect,
      height: Math.round(Math.max(updated.rect.height, maxBottom - updated.rect.y)),
    },
  };
}

/**
 * Re-root on the phone column. Default expands to full scroll height; bridge uses viewportOnly
 * so the canvas matches what the dev preview shows (no gap between content and bottom nav).
 */
export function focusDomTreeOnReactScreenRoot(
  root: DomSnapshotNode,
  viewport: { width: number; height: number },
  opts?: { viewportOnly?: boolean },
): DomSnapshotNode {
  const screen = findBestScreenCandidate(root, viewport);
  if (!screen) return root;

  const shifted = shiftDomTree(screen, screen.rect.x, screen.rect.y);

  if (opts?.viewportOnly) {
    return {
      ...shifted,
      rect: {
        x: 0,
        y: 0,
        width: Math.round(shifted.rect.width),
        height: viewport.height,
      },
    };
  }

  const contentHeight = Math.round(descendantContentHeight(shifted));
  const focused = {
    ...shifted,
    rect: {
      x: 0,
      y: 0,
      width: Math.round(shifted.rect.width),
      height: Math.max(contentHeight, viewport.height),
    },
  };
  const expanded = expandScrollContainersInDomTree(focused);
  return pinPhoneShellBottomChromeInDomTree(expanded, expanded.rect.height);
}
