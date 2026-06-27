import { collectSubtreeIds } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

const COMPONENT_CLASS_HINT =
  /\b(btn|badge|chip|list-item|listitem|avatar|toggle|checkbox|radio|input-field|loading)\b/;

/** True for atomic design-system components — keep browser-measured composition, not flex reflow. */
export function isManualComponentFrame(node: EditorNode): boolean {
  const cls = (node.codeClassName ?? "").toLowerCase();
  if (COMPONENT_CLASS_HINT.test(cls)) return true;
  if (node.codeJsxTag === "Button" || node.codeJsxTag === "Badge") return true;
  if (/^button$/i.test(node.name.trim())) return true;
  if (/^badge$/i.test(node.name.trim())) return true;
  return false;
}

/**
 * Storybook / atomic component captures: disable auto layout and pin children to
 * captured absolute coordinates so icon + label spacing stays 1:1 (no uniform flex stretch).
 */
export function enforceManualComponentComposition(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootIds?: string[],
): void {
  const roots = rootIds?.length ? rootIds : (childOrder[EDITOR_ROOT_KEY] ?? []);
  const subtreeIds = new Set<string>();
  for (const rootId of roots) {
    for (const id of collectSubtreeIds(rootId, childOrder)) {
      subtreeIds.add(id);
    }
  }
  if (subtreeIds.size === 0) return;

  for (const id of subtreeIds) {
    const node = nodes[id];
    if (!node) continue;
    if (node.type !== "frame" && node.type !== "group") continue;
    nodes[id] = {
      ...node,
      layoutMode: "none",
      layoutGap: 0,
      layoutWrap: false,
      layoutGapAuto: false,
      layoutDirty: false,
    };
  }

  for (const id of subtreeIds) {
    const node = nodes[id];
    if (!node?.parentId || !subtreeIds.has(node.parentId)) continue;
    nodes[id] = {
      ...node,
      layoutPositioning: "absolute",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "fixed",
      layoutGrow: undefined,
      layoutDirty: false,
    };
  }
}

export function captureRootIds(childOrder: Record<string, string[]>): string[] {
  return childOrder[EDITOR_ROOT_KEY] ?? [];
}
