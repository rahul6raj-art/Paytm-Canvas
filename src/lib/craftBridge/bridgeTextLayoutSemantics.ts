import type { EditorNode } from "@/stores/useEditorStore";

/** True when the text layer lives under a bridge-imported screen artboard. */
export function isUnderBridgeScreenArtboard(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  let cur: EditorNode | undefined = node;
  while (cur?.parentId) {
    const parent = nodes[cur.parentId];
    if (!parent) break;
    if (parent.manualScreenLayout || parent.bridgeSourcePath) return true;
    cur = parent;
  }
  return false;
}

/** Bridge captures use the DOM box as the text frame — no Craft fixed-text vertical inset. */
export function withBridgeDomTextBox(
  node: EditorNode,
  nodes?: Record<string, EditorNode>,
): EditorNode {
  if (node.type !== "text") return node;
  const underBridge = Boolean(nodes && isUnderBridgeScreenArtboard(node, nodes));
  if (!node.bridgeDomTextBox && !underBridge) return node;
  return {
    ...node,
    bridgeDomTextBox: true,
    // Playwright box already encodes CSS line-box placement — paint from the top edge.
    verticalAlign:
      node.verticalAlign === "bottom" ? "bottom" : ("top" as const),
  };
}
