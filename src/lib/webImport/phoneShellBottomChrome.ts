import type { DomSnapshotNode } from "@/lib/webImport/types";
import type { EditorNode } from "@/stores/useEditorStore";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";

export { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";

/** Wrapper classes for BottomNav / HomeIndicator chrome in PML phone shells. */
const BOTTOM_CHROME_CLASS_RE = /__(?:bottom-nav|home-indicator)\b/;

export function isPhoneShellBottomChrome(className?: string | null, codeJsxTag?: string | null): boolean {
  const cls = className ?? "";
  if (BOTTOM_CHROME_CLASS_RE.test(cls)) return true;
  if (codeJsxTag === "BottomNav" || codeJsxTag === "HomeIndicator") return true;
  return false;
}

function shiftDomTree(node: DomSnapshotNode, dx: number, dy: number): DomSnapshotNode {
  return {
    ...node,
    rect: {
      ...node.rect,
      x: node.rect.x + dx,
      y: node.rect.y + dy,
    },
    children: node.children.map((child) => shiftDomTree(child, dx, dy)),
  };
}

/** Pin bottom nav / home indicator to the bottom of the phone shell artboard. */
export function pinPhoneShellBottomChromeInDomTree(
  root: DomSnapshotNode,
  shellHeight: number,
): DomSnapshotNode {
  if (!isPhoneShellClassName(root.className)) {
    return {
      ...root,
      children: root.children.map((child) => pinPhoneShellBottomChromeInDomTree(child, shellHeight)),
    };
  }

  const shellTop = root.rect.y;
  const height = Math.max(shellHeight, root.rect.height);
  const newChildren = root.children.map((child) => {
    if (!isPhoneShellBottomChrome(child.className)) return child;
    const targetY = shellTop + height - child.rect.height;
    const dy = targetY - child.rect.y;
    if (Math.abs(dy) < 2) return child;
    return shiftDomTree(child, 0, dy);
  });

  return { ...root, children: newChildren };
}

export function pinPhoneShellBottomChromeNodes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  shellHeight: number,
): void {
  for (const [shellId, kids] of Object.entries(childOrder)) {
    const shell = nodes[shellId];
    if (!shell || !isPhoneShellClassName(shell.codeClassName)) continue;

    const chromeIds: string[] = [];
    const restIds: string[] = [];
    const targetShellHeight = Math.max(shell.height, shellHeight);

    for (const kidId of kids) {
      const kid = nodes[kidId];
      if (!kid || kid.visible === false) {
        restIds.push(kidId);
        continue;
      }
      if (!isPhoneShellBottomChrome(kid.codeClassName, kid.codeJsxTag)) {
        restIds.push(kidId);
        continue;
      }

      const targetY = Math.max(0, targetShellHeight - kid.height);
      if (Math.abs(kid.y - targetY) > 2) {
        nodes[kidId] = { ...kid, y: targetY };
      }
      chromeIds.push(kidId);
    }

    if (chromeIds.length > 0) {
      childOrder[shellId] = [...restIds, ...chromeIds];
    }
  }
}
