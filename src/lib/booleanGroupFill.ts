import { isBooleanEligibleNode, isBooleanGroup } from "@/lib/booleanGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import type { NodeStylePatch } from "@/stores/useEditorStore";

const FILL_STYLE_KEYS = [
  "fill",
  "fillType",
  "fillGradient",
  "fillOpacity",
  "fillEnabled",
] as const satisfies readonly (keyof NodeStylePatch)[];

function pickFillPatch(patch: NodeStylePatch): NodeStylePatch {
  const out: NodeStylePatch = {};
  for (const key of FILL_STYLE_KEYS) {
    if (key in patch && patch[key] !== undefined) {
      (out as Record<string, unknown>)[key] = patch[key];
    }
  }
  return out;
}

function hasFillPatch(patch: NodeStylePatch): boolean {
  return FILL_STYLE_KEYS.some((key) => key in patch && patch[key] !== undefined);
}

/**
 * When fill changes on a boolean group or its operands, keep group + operands aligned
 * so canvas preview and HTML export use the same color.
 */
export function expandBooleanFillStylePatches(
  nodeId: string,
  patch: NodeStylePatch,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, NodeStylePatch> | null {
  if (!hasFillPatch(patch)) return null;

  const fillPatch = pickFillPatch(patch);
  const node = nodes[nodeId];
  if (!node) return null;

  const out: Record<string, NodeStylePatch> = {};

  if (isBooleanGroup(node)) {
    out[nodeId] = patch;
    for (const cid of childOrder[nodeId] ?? []) {
      const child = nodes[cid];
      if (!child?.visible || child.locked || !isBooleanEligibleNode(child)) continue;
      out[cid] = fillPatch;
    }
    return out;
  }

  const parentId = node.parentId;
  if (!parentId) return null;
  const parent = nodes[parentId];
  if (!isBooleanGroup(parent)) return null;

  out[nodeId] = patch;
  out[parentId] = fillPatch;
  for (const cid of childOrder[parentId] ?? []) {
    if (cid === nodeId) continue;
    const sibling = nodes[cid];
    if (!sibling?.visible || sibling.locked || !isBooleanEligibleNode(sibling)) continue;
    out[cid] = fillPatch;
  }
  return out;
}
