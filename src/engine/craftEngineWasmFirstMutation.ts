import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  mirrorDocumentDeltaToWasm,
  mirrorWasmFromStore,
} from "@/engine/craftEngineAuthorityStructure";
import { isWasmUiMirrorMode } from "@/engine/craftEngineAuthorityMirror";
import { getCraftEngineSyncState } from "@/engine/craftEngineRegistry";
import type { CraftEngineDocument } from "@/engine/craftEngineTypes";
import { isNativeRendererEnabled, isWasmFirstMutationsEnabled } from "@/lib/craftPublicConfig";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import {
  ROOT,
  useEditorStore,
  type EditorAsset,
  type EditorNode,
} from "@/stores/useEditorStore";

export type WasmFirstDocumentSlice = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
};

export type DocumentMutationResult = WasmFirstDocumentSlice & {
  ui: Record<string, unknown>;
};

/** When true, structural edits apply to WASM first; Zustand mirrors the WASM snapshot. */
export function isWasmFirstMutationsMode(): boolean {
  return (
    isWasmDocumentAuthority() &&
    isNativeRendererEnabled() &&
    isWasmUiMirrorMode() &&
    isWasmFirstMutationsEnabled()
  );
}

function documentFromSlice(
  slice: WasmFirstDocumentSlice,
  assets: Record<string, EditorAsset>,
): CraftEngineDocument {
  return craftEngineDocumentFromStore({
    nodes: slice.nodes,
    childOrder: slice.childOrder,
    rootIds: slice.childOrder[ROOT] ?? EMPTY_CHILD_IDS,
    assets,
  });
}

/**
 * Apply a document slice to WASM, then mirror the WASM snapshot into Zustand.
 * Returns false when WASM-first mode is off or the engine is unavailable.
 */
export function applyWasmFirstDocumentSlice(
  slice: WasmFirstDocumentSlice,
  uiPatch?: Record<string, unknown>,
): boolean {
  if (!isWasmFirstMutationsMode()) return false;

  const st = useEditorStore.getState();
  if (st.isApplyingHistory || st.isApplyingWasmMirror) return false;

  const syncState = getCraftEngineSyncState();
  if (!syncState?.lastDocument) return false;

  const next = documentFromSlice(slice, st.assets);
  const applied = mirrorDocumentDeltaToWasm(syncState.lastDocument, next);
  if (!applied) return false;

  if (uiPatch && Object.keys(uiPatch).length > 0) {
    useEditorStore.setState(uiPatch);
  }
  return true;
}

/**
 * Apply a document slice to the store, then mirror to WASM when WASM-first mode is on.
 * Store must update first: WASM does not round-trip style-only fields (ellipse arc, etc.).
 */
export function commitDocumentMutation(
  result: DocumentMutationResult | null,
  fallbackApply: (result: DocumentMutationResult) => void,
): void {
  if (!result) return;
  fallbackApply(result);
}

/** WASM-first batch geometry commit (e.g. drag pointer-up). */
export function commitWasmFirstGeometryPatches(
  updates: Array<{ nodeId: string; node: EditorNode }>,
): boolean {
  if (!isWasmFirstMutationsMode() || updates.length === 0) return false;
  const st = useEditorStore.getState();
  if (st.isApplyingHistory || st.isApplyingWasmMirror) return false;

  const nodes = { ...st.nodes };
  for (const { nodeId, node } of updates) {
    nodes[nodeId] = node;
  }
  // Keep Zustand aligned before deferred WASM reconcile (e.g. duplicate repeat offset).
  useEditorStore.setState({ nodes });
  return applyWasmFirstDocumentSlice({ nodes, childOrder: st.childOrder });
}

/** Sync WASM after a store update (style/geometry fallback) or reconcile when WASM-first is on. */
export function syncWasmDocumentAfterStoreUpdate(uiPatch?: Record<string, unknown>): void {
  const st = useEditorStore.getState();
  if (
    applyWasmFirstDocumentSlice(
      { nodes: st.nodes, childOrder: st.childOrder },
      uiPatch,
    )
  ) {
    return;
  }
  mirrorWasmFromStore();
}
