import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  isManualScreenFrame,
  rootFrameIds,
} from "@/lib/webImport/manualScreenFrames";

/** Root artboards that came from a bridge live capture (push from preview). */
export function bridgeCaptureRootIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Set<string> {
  const canvasRoots = rootFrameIds(childOrder);
  const out = new Set<string>();
  for (const id of canvasRoots) {
    const node = nodes[id];
    if (!node) continue;
    if (
      node.bridgeSourcePath?.trim() ||
      node.manualScreenLayout ||
      isManualScreenFrame(node, canvasRoots)
    ) {
      out.add(id);
    }
  }
  return out;
}

export function isUnderBridgeCaptureScreen(
  nodes: Record<string, EditorNode>,
  nodeId: string,
  childOrder: Record<string, string[]>,
): boolean {
  const bridgeRoots = bridgeCaptureRootIds(nodes, childOrder);
  if (bridgeRoots.size === 0) return false;
  let cur: string | null = nodeId;
  while (cur) {
    if (bridgeRoots.has(cur)) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

function clearAutoLayoutContainerFields(node: EditorNode): Partial<EditorNode> {
  return {
    layoutMode: "none",
    layoutGap: 0,
    layoutGapAuto: false,
    layoutWrap: false,
    primaryAxisAlign: undefined,
    counterAxisAlign: undefined,
    layoutDirty: false,
  };
}

function pinCapturedChildLayout(node: EditorNode): Partial<EditorNode> {
  return {
    layoutPositioning: "absolute",
    layoutSizingHorizontal: "fixed",
    layoutSizingVertical: "fixed",
    layoutGrow: 0,
    layoutDirty: false,
  };
}

/**
 * Bridge pushes use absolute coordinates from the browser. Strip flex/auto-layout from the
 * entire screen subtree so edits (text, move, resize) never reflow siblings.
 */
export function freezeBridgeCaptureSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const bridgeRoots = bridgeCaptureRootIds(nodes, childOrder);
  if (bridgeRoots.size === 0) return;

  const walk = (id: string) => {
    const node = nodes[id];
    if (!node) return;

    if (node.type === "text") {
      return;
    }
    if (node.type === "frame" || node.type === "group") {
      nodes[id] = {
        ...node,
        ...clearAutoLayoutContainerFields(node),
        ...(bridgeRoots.has(id)
          ? {
              manualScreenLayout: true,
              clipChildren: node.clipChildren ?? true,
            }
          : {}),
      };
    }

    for (const kidId of childOrder[id] ?? []) {
      const kid = nodes[kidId];
      if (!kid || kid.parentId !== id) continue;
      if (kid.type !== "text") {
        nodes[kidId] = { ...kid, ...pinCapturedChildLayout(kid) };
      }
      walk(kidId);
    }
  };

  for (const rootId of bridgeRoots) {
    walk(rootId);
  }
}

/** Skip auto-layout relayout for parents inside a bridge-captured screen. */
export function filterBridgeCaptureRelayoutParents(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentKeys: Iterable<string>,
): string[] {
  const bridgeRoots = bridgeCaptureRootIds(nodes, childOrder);
  if (bridgeRoots.size === 0) return [...parentKeys];

  return [...parentKeys].filter((pk) => {
    if (pk === EDITOR_ROOT_KEY) return false;
    const parent = nodes[pk];
    if (!parent) return false;
    if ((parent.layoutMode ?? "none") === "none") return false;
    return !isUnderBridgeCaptureScreen(nodes, pk, childOrder);
  });
}
