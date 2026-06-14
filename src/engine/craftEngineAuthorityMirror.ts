import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  planIncrementalDocumentOps,
  type CraftEngineSyncState,
} from "@/engine/craftEngineIncrementalSync";
import { getActiveCraftEngine, getCraftEngineSyncState } from "@/engine/craftEngineRegistry";
import type { CraftEngineDocument } from "@/engine/craftEngineTypes";
import {
  mergeWasmSnapshotWithStore,
  wasmSnapshotToStorePatch,
  type WasmSnapshotStorePatch,
} from "@/engine/craftEngineSnapshotApply";
import { isNativeRendererEnabled, isWasmUiMirrorModeEnabled } from "@/lib/craftPublicConfig";
import { isAutoLayoutHandleDragActive } from "@/lib/autoLayout/autoLayoutDragSession";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

let deferredWasmReconcile = false;

/** When true, Zustand mirrors WASM snapshots; compositor skips redundant store→WASM sync. */
export function isWasmUiMirrorMode(): boolean {
  return (
    isWasmDocumentAuthority() &&
    isNativeRendererEnabled() &&
    isWasmUiMirrorModeEnabled()
  );
}

export function storePatchMatchesDocument(
  patch: WasmSnapshotStorePatch,
  nodes: Record<string, unknown>,
  childOrder: Record<string, string[]>,
): boolean {
  return (
    JSON.stringify(nodes) === JSON.stringify(patch.nodes) &&
    JSON.stringify(childOrder) === JSON.stringify(patch.childOrder)
  );
}

/** True when eager WASM authority already matches the store document (skip compositor sync). */
export function shouldElideCompositorDocumentSync(
  next: CraftEngineDocument,
  state: CraftEngineSyncState,
): boolean {
  if (!isWasmUiMirrorMode()) return false;
  if (!state.lastDocument) return false;
  return planIncrementalDocumentOps(state.lastDocument, next) === "noop";
}

function advanceSyncBaselineFromPatch(patch: WasmSnapshotStorePatch): void {
  const state = getCraftEngineSyncState();
  if (!state) return;
  const assets = useEditorStore.getState().assets;
  state.lastDocument = craftEngineDocumentFromStore({
    nodes: patch.nodes,
    childOrder: patch.childOrder,
    rootIds: patch.childOrder[ROOT] ?? EMPTY_CHILD_IDS,
    assets,
  });
}

/** True when no in-flight canvas transform is mutating geometry. */
export function isWasmDocumentMutationIdle(): boolean {
  const st = useEditorStore.getState();
  return (
    st.transformInteractionMode === "none" &&
    !st.isMovingSelection &&
    !st.isApplyingWasmMirror &&
    !st.isApplyingHistory &&
    !isAutoLayoutHandleDragActive()
  );
}

/** Queue a WASM→store reconcile for when drag/resize completes. */
export function requestDeferredWasmReconcile(): void {
  if (!isWasmUiMirrorMode()) return;
  deferredWasmReconcile = true;
}

/** Run a queued reconcile after pointer-up / transform end. */
export function flushDeferredWasmReconcile(): boolean {
  if (!deferredWasmReconcile) return false;
  deferredWasmReconcile = false;
  return reconcileStoreFromWasmSnapshot();
}

/**
 * Reconcile store from WASM immediately when idle; defer until transform ends otherwise.
 */
export function reconcileStoreFromWasmWhenIdle(): boolean {
  if (!isWasmUiMirrorMode()) return false;
  if (!isWasmDocumentMutationIdle()) {
    requestDeferredWasmReconcile();
    return false;
  }
  deferredWasmReconcile = false;
  return reconcileStoreFromWasmSnapshot();
}

/** Apply WASM `snapshotDocument()` to Zustand when it differs from the current store slice. */
export function reconcileStoreFromWasmSnapshot(): boolean {
  if (!isWasmUiMirrorMode()) return false;
  if (useEditorStore.getState().isApplyingWasmMirror) return false;
  if (useEditorStore.getState().isApplyingHistory) return false;

  const engine = getActiveCraftEngine();
  if (!engine) return false;

  try {
    const json = engine.snapshotDocument();
    if (!json) return false;
    const patch = wasmSnapshotToStorePatch(json);
    if (!patch) return false;

    const st = useEditorStore.getState();
    const merged = mergeWasmSnapshotWithStore(st.nodes, patch);
    if (storePatchMatchesDocument(merged, st.nodes, st.childOrder)) {
      advanceSyncBaselineFromPatch(merged);
      return false;
    }

    useEditorStore.getState().applyWasmDocumentPatch(merged);
    advanceSyncBaselineFromPatch(merged);
    return true;
  } catch {
    return false;
  }
}
