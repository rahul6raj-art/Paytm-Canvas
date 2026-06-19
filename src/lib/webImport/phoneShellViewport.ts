import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { expandWebImportScrollFrames } from "@/lib/webImport/normalizeWebImportLayers";

const PHONE_SHELL_CLASS_TOKENS = new Set([
  "pml-home",
  "pml-signup",
  "pml-onboarding",
  "pml-more",
  "pml-stocks",
]);

const PHONE_SCROLL_CLASS_RE = /__(?:scroll|main)\b/;

export function isPhoneShellClassName(className?: string | null): boolean {
  const tokens = (className ?? "").trim().split(/\s+/).filter(Boolean);
  return tokens.some((t) => PHONE_SHELL_CLASS_TOKENS.has(t.toLowerCase()));
}

export function isPhoneShellScrollClassName(className?: string | null): boolean {
  return PHONE_SCROLL_CLASS_RE.test(className ?? "");
}

/** Scroll regions expand to content height — do not shrink via expandFramesToFitChildren. */
export function shouldPreserveViewportFrameBounds(node: Pick<EditorNode, "codeClassName">): boolean {
  const cls = node.codeClassName ?? "";
  return isPhoneShellClassName(cls) || isPhoneShellScrollClassName(cls);
}

/**
 * Full-page phone capture: expand scroll areas, show all sections, pin shell width to column.
 * Does not clip to the first viewport — below-the-fold content stays visible on canvas.
 */
export function applyPhoneShellFullPageLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  pageWidth: number,
  pageHeight: number,
): void {
  expandWebImportScrollFrames(nodes, childOrder);

  const phoneColumn = pageWidth > 0 && pageWidth <= 420;

  for (const [id, node] of Object.entries(nodes)) {
    const cls = node.codeClassName ?? "";
    if (isPhoneShellScrollClassName(cls)) {
      nodes[id] = { ...node, clipChildren: false };
    }
  }

  for (const [shellId, kids] of Object.entries(childOrder)) {
    const shell = nodes[shellId];
    if (!shell || !isPhoneShellClassName(shell.codeClassName)) continue;

    let maxBottom = 0;
    for (const kidId of kids) {
      const kid = nodes[kidId];
      if (!kid || kid.visible === false) continue;
      maxBottom = Math.max(maxBottom, kid.y + kid.height);
    }

    nodes[shellId] = {
      ...shell,
      clipChildren: false,
      width: phoneColumn ? pageWidth : shell.width,
      height: Math.max(Math.ceil(maxBottom), shell.height, pageHeight),
    };
  }

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const root = nodes[rootId];
    if (!root) continue;
    if (!isPhoneShellClassName(root.codeClassName) && !phoneColumn) continue;
    nodes[rootId] = {
      ...root,
      clipChildren: false,
      width: phoneColumn ? pageWidth : Math.max(root.width, pageWidth),
      height: Math.max(root.height, pageHeight),
    };
  }
}

/** @deprecated Use applyPhoneShellFullPageLayout — viewport-only clip hides below-the-fold content. */
export const applyPhoneShellViewportClip = applyPhoneShellFullPageLayout;
