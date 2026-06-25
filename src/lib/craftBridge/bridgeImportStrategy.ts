import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { canvasScreenLabelFromSource } from "@/lib/craftBridge/canvasScreenLabels";

export type BridgeImportStrategy =
  | { mode: "replace" }
  | { mode: "append" }
  | { mode: "replace-root"; rootId: string; x: number; y: number };

export function screenLabelFromSourcePath(sourcePath: string): string {
  return canvasScreenLabelFromSource(sourcePath);
}

function normalizeSourcePath(sourcePath: string): string {
  return sourcePath.replace(/\\/g, "/").toLowerCase();
}

function rootMatchesSourcePath(
  node: EditorNode,
  normalizedSourcePath: string,
  label: string,
): boolean {
  const tagged = node.bridgeSourcePath?.trim();
  if (tagged && normalizeSourcePath(tagged) === normalizedSourcePath) return true;
  return node.name === label;
}

/** Decide whether to replace, append beside, or swap an existing artboard for the same screen. */
export function resolveBridgeImportStrategy(
  state: {
    childOrder: Record<string, string[]>;
    nodes: Record<string, EditorNode>;
    codeRoundTripLink?: CodeRoundTripLink | null;
  },
  incomingSourcePath?: string,
): BridgeImportStrategy {
  const roots = state.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (roots.length === 0) return { mode: "replace" };

  const normalizedIncoming = incomingSourcePath?.trim()
    ? normalizeSourcePath(incomingSourcePath)
    : null;
  if (normalizedIncoming) {
    const label = screenLabelFromSourcePath(incomingSourcePath!);
    for (const rootId of roots) {
      const node = state.nodes[rootId];
      if (!node || node.visible === false) continue;
      if (rootMatchesSourcePath(node, normalizedIncoming, label)) {
        return { mode: "replace-root", rootId, x: node.x, y: node.y };
      }
    }

    const linked = state.codeRoundTripLink?.sourcePath?.trim();
    if (linked && normalizeSourcePath(linked) === normalizedIncoming && roots.length === 1) {
      const node = state.nodes[roots[0]!]!;
      return { mode: "replace-root", rootId: roots[0]!, x: node.x, y: node.y };
    }
  }

  return { mode: "append" };
}

export function tagSliceRootsWithBridgeSource(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sourcePath?: string,
): Record<string, EditorNode> {
  if (!sourcePath?.trim()) return nodes;
  const roots = childOrder[EDITOR_ROOT_KEY] ?? [];
  if (roots.length === 0) return nodes;

  const next = { ...nodes };
  for (const rootId of roots) {
    const node = next[rootId];
    if (node && !node.parentId) {
      next[rootId] = { ...node, bridgeSourcePath: sourcePath.replace(/\\/g, "/") };
    }
  }
  return next;
}

export function removeRootSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const toRemove = new Set<string>();
  const walk = (id: string) => {
    if (toRemove.has(id)) return;
    toRemove.add(id);
    for (const childId of childOrder[id] ?? []) walk(childId);
  };
  walk(rootId);

  const nextNodes = { ...nodes };
  for (const id of toRemove) delete nextNodes[id];

  const nextOrder: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(childOrder)) {
    nextOrder[key] = list.filter((id) => !toRemove.has(id));
  }

  return { nodes: nextNodes, childOrder: nextOrder };
}
