import type { EditorNode } from "@/stores/useEditorStore";
import { synthesizeWebImportAutoLayout } from "@/lib/webImport/synthesizeWebImportAutoLayout";

/** Apply calibrated auto layout with 1:1 fidelity verification (falls back to absolute). */
export function applyWebImportAutoLayoutStructure(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  synthesizeWebImportAutoLayout(nodes, childOrder);
}
