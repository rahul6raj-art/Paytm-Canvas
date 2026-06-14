/**
 * Legacy entry — delegates to booleanGeometry.ts (Clipper2 flatten kernel).
 */
export type { BooleanOperation } from "@/lib/booleanGeometry";
export {
  applyBooleanOperation,
  shapesToBooleanInput,
  booleanResultToPathNode,
} from "@/lib/booleanGeometry";

import type { EditorNode } from "@/stores/useEditorStore";
import {
  applyBooleanOperation as applyOp,
  booleanResultToPathNode,
  getBooleanEligibleSelection,
  shapesToBooleanInput,
  type BooleanOperation,
} from "@/lib/booleanGeometry";

/** @deprecated Use createBooleanGroup in the store instead. */
export function applyBooleanOperationLegacy(
  operation: BooleanOperation,
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): { newNode: EditorNode | null; removeIds: string[]; message?: string } | null {
  const tops = getBooleanEligibleSelection(selectedIds, nodes);
  if (tops.length < 2) return null;
  const inputs = shapesToBooleanInput(tops, nodes);
  const result = applyOp(operation, inputs);
  if (!result) return null;
  const newNode = booleanResultToPathNode(result, nodes[tops[0]!]!, nodes[tops[0]!]!.parentId);
  return { newNode, removeIds: tops };
}
