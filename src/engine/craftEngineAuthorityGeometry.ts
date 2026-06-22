import { isNativeRendererEnabled } from "@/lib/craftPublicConfig";
import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  getActiveCraftEngine,
  getCraftEngineSyncState,
} from "@/engine/craftEngineRegistry";
import { runCraftEngineAccess } from "@/engine/craftEngineMutation";
import type { CraftEngineDocument } from "@/engine/craftEngineTypes";
import type { EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";

const GEOMETRY_MIRROR_KEYS = new Set([
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "lineX1",
  "lineY1",
  "lineX2",
  "lineY2",
]);

export type WasmGeometryOp = {
  op: string;
  nodeId: string;
  fields: Record<string, unknown>;
};

export function patchTouchesGeometry(patch: Partial<EditorNode>): boolean {
  return Object.keys(patch).some((k) => GEOMETRY_MIRROR_KEYS.has(k));
}

/** Build a WASM `moveNode` or `updateNode` op for a geometry patch. */
export function buildGeometryDocumentOp(
  nodeId: string,
  patch: Partial<EditorNode>,
  node: EditorNode,
): WasmGeometryOp | null {
  if (!patchTouchesGeometry(patch)) return null;

  const keys = Object.keys(patch).filter((k) => GEOMETRY_MIRROR_KEYS.has(k));
  if (
    keys.length <= 2 &&
    keys.every((k) => k === "x" || k === "y") &&
    patch.x != null &&
    patch.y != null
  ) {
    return {
      op: "moveNode",
      nodeId,
      fields: { x: node.x, y: node.y },
    };
  }

  const fields: Record<string, unknown> = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation ?? 0,
  };
  if (node.lineX1 != null) fields.lineX1 = node.lineX1;
  if (node.lineY1 != null) fields.lineY1 = node.lineY1;
  if (node.lineX2 != null) fields.lineX2 = node.lineX2;
  if (node.lineY2 != null) fields.lineY2 = node.lineY2;
  if (node.flipHorizontal != null) fields.flipHorizontal = node.flipHorizontal;
  if (node.flipVertical != null) fields.flipVertical = node.flipVertical;

  return {
    op: "updateNode",
    nodeId,
    fields,
  };
}

function advanceSyncBaseline(
  state: { lastDocument: CraftEngineDocument | null },
  updates: Array<{ nodeId: string; node: EditorNode }>,
): void {
  if (!state.lastDocument) return;
  const nextNodes = { ...state.lastDocument.nodes };
  for (const { nodeId, node } of updates) {
    nextNodes[nodeId] = node;
  }
  state.lastDocument = { ...state.lastDocument, nodes: nextNodes };
}

export type GeometryMirrorEntry = {
  nodeId: string;
  patch: Partial<EditorNode>;
  node: EditorNode;
};

/**
 * Apply geometry ops directly to WASM (authority phase 3) and advance the compositor
 * sync baseline so the next document sync is a noop.
 */
export function mirrorGeometryPatchesToWasm(entries: GeometryMirrorEntry[]): boolean {
  if (!isWasmDocumentAuthority() || !isNativeRendererEnabled()) return false;
  const st = useEditorStore.getState();
  if (st.isApplyingHistory || st.isApplyingWasmMirror) return false;

  const engine = getActiveCraftEngine();
  const state = getCraftEngineSyncState();
  if (!engine || !state?.lastDocument) return false;

  const ops: WasmGeometryOp[] = [];
  const baselineUpdates: Array<{ nodeId: string; node: EditorNode }> = [];

  for (const { nodeId, patch, node } of entries) {
    const op = buildGeometryDocumentOp(nodeId, patch, node);
    if (!op) continue;
    ops.push(op);
    baselineUpdates.push({ nodeId, node });
  }

  if (ops.length === 0) return false;

  try {
    runCraftEngineAccess(() => {
      if (ops.length === 1) {
        engine.applyDocumentOp(JSON.stringify(ops[0]));
      } else {
        engine.applyDocumentOps(JSON.stringify(ops));
      }
    });
    advanceSyncBaseline(state, baselineUpdates);
    return true;
  } catch {
    return false;
  }
}

export function mirrorNodeGeometryToWasm(
  nodeId: string,
  patch: Partial<EditorNode>,
  node: EditorNode,
): boolean {
  return mirrorGeometryPatchesToWasm([{ nodeId, patch, node }]);
}
