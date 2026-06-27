import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { releaseAutoLayoutContainerToManual } from "@/lib/autoLayout/releaseAutoLayoutToManual";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";

const PML_SCREEN_NAME_RE = /^PML-\s/i;

/** True for imported screen artboards / phone shells — manual layout, never flex reflow. */
export function isManualScreenFrame(
  node: EditorNode,
  _rootIds: ReadonlySet<string>,
): boolean {
  if (node.manualScreenLayout) return true;
  if (isPhoneShellClassName(node.codeClassName)) return true;
  if (PML_SCREEN_NAME_RE.test(node.name.trim())) return true;
  return false;
}

export function rootFrameIds(childOrder: Record<string, string[]>): Set<string> {
  return new Set(childOrder[EDITOR_ROOT_KEY] ?? []);
}

/** Imported screens must stay manual — undo accidental auto layout on artboards. */
export function ensureManualScreenLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  frameId: string,
): Record<string, EditorNode> {
  const node = nodes[frameId];
  if (!node) return nodes;
  if (!isManualScreenFrame(node, rootFrameIds(childOrder))) return nodes;
  if ((node.layoutMode ?? "none") === "none") {
    return {
      ...nodes,
      [frameId]: {
        ...node,
        layoutGap: 0,
        layoutGapAuto: false,
        layoutDirty: false,
      },
    };
  }
  return releaseAutoLayoutContainerToManual(nodes, childOrder, frameId);
}
