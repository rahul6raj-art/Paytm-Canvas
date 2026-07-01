import type { EditorNode } from "@/stores/useEditorStore";

/** Live DOM capture nodes use ids like `web-1`, `web-root-2`. */
export function isWebImportNodeId(id: string): boolean {
  return id.startsWith("web-");
}

/** Bridge / import-web text nodes (used for capture layout and import heuristics). */
export function isWebImportedTextNode(
  node: Pick<EditorNode, "id" | "type"> | null | undefined,
): boolean {
  return node?.type === "text" && isWebImportNodeId(node.id);
}
