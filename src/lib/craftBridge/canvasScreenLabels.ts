/** Strip dev-server suffixes from captured browser tab titles. */
export function stripBrowserPageTitle(title: string): string {
  return title
    .replace(/\s*\(\s*npm\s+run\s+dev\s*\)\s*$/i, "")
    .replace(/\s*[—–-]\s*(?:vite|webpack|react).*$/i, "")
    .replace(/\s*\|\s*.+$/, "")
    .trim();
}

const PML_PAGE_COMPONENT_RE = /^PML([A-Z][a-zA-Z]*)Page$/;

/** Human canvas artboard label from a source file or component name (e.g. PMLMorePage.tsx → PML- More). */
export function canvasScreenLabelFromSource(source: string): string {
  const base = source.replace(/\\/g, "/").split("/").pop() ?? source;
  const stem = base.replace(/\.(tsx|jsx|html|htm)$/i, "").trim();
  if (!stem) return "Imported screen";

  const pml = stem.match(PML_PAGE_COMPONENT_RE);
  if (pml) return `PML- ${pml[1]}`;

  if (/Page$/i.test(stem)) {
    const withoutPage = stem.replace(/Page$/i, "");
    const spaced = withoutPage.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
    return spaced || stem;
  }

  return stem.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim() || stem;
}

/** Map a captured tab title to a canvas label when no source file name is available. */
export function canvasScreenLabelFromPageTitle(title: string): string | null {
  const stripped = stripBrowserPageTitle(title);
  if (!stripped) return null;

  const pml = stripped.match(/^PML\s*[-–]?\s*(.+)$/i);
  if (pml) {
    const screen = pml[1]!
      .replace(/\s*\(\s*npm\s+run\s+dev\s*\)\s*$/i, "")
      .trim();
    return `PML- ${screen}`;
  }

  const componentLike = stripped.replace(/\s+/g, "");
  if (PML_PAGE_COMPONENT_RE.test(componentLike)) {
    return canvasScreenLabelFromSource(componentLike);
  }

  return stripped;
}

export function applyCanvasScreenLabelToRoots(
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  rootIds: string[],
  label: string,
): Record<string, import("@/stores/useEditorStore").EditorNode> {
  if (!label.trim() || rootIds.length === 0) return nodes;
  const next = { ...nodes };
  for (const rootId of rootIds) {
    const root = next[rootId];
    if (root && !root.parentId) {
      next[rootId] = { ...root, name: label };
    }
  }
  return next;
}
