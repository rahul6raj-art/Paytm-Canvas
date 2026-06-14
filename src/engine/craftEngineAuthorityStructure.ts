import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import { reconcileStoreFromWasmWhenIdle } from "@/engine/craftEngineAuthorityMirror";
import {
  planIncrementalDocumentOps,
  type CraftEngineOp,
} from "@/engine/craftEngineIncrementalSync";
import {
  getActiveCraftEngine,
  getCraftEngineSyncState,
} from "@/engine/craftEngineRegistry";
import type { CraftEngineDocument } from "@/engine/craftEngineTypes";
import { isNativeRendererEnabled } from "@/lib/craftPublicConfig";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";

function applyWasmOps(engine: NonNullable<ReturnType<typeof getActiveCraftEngine>>, ops: CraftEngineOp[]): void {
  if (ops.length === 1) {
    engine.applyDocumentOp(JSON.stringify(ops[0]));
  } else {
    engine.applyDocumentOps(JSON.stringify(ops));
  }
}

/**
 * Apply structural/style deltas directly to WASM and advance the compositor baseline.
 */
export function mirrorDocumentDeltaToWasm(
  prev: CraftEngineDocument,
  next: CraftEngineDocument,
): boolean {
  if (!isWasmDocumentAuthority() || !isNativeRendererEnabled()) return false;
  const st = useEditorStore.getState();
  if (st.isApplyingHistory || st.isApplyingWasmMirror) return false;

  const engine = getActiveCraftEngine();
  const state = getCraftEngineSyncState();
  if (!engine || !state) return false;

  const plan = planIncrementalDocumentOps(prev, next);
  if (plan === "noop") return false;

  try {
    if (plan === "full") {
      engine.syncDocument(JSON.stringify(next));
    } else {
      applyWasmOps(engine, plan);
    }
    state.lastDocument = next;
    reconcileStoreFromWasmWhenIdle();
    return true;
  } catch {
    return false;
  }
}

/** Mirror the current Zustand document slice to WASM using the registered sync baseline. */
export function mirrorWasmFromStore(): boolean {
  const state = getCraftEngineSyncState();
  if (!state?.lastDocument) return false;

  const st = useEditorStore.getState();
  if (st.isApplyingWasmMirror) return false;
  const next = craftEngineDocumentFromStore({
    nodes: st.nodes,
    childOrder: st.childOrder,
    rootIds: st.childOrder[ROOT] ?? EMPTY_CHILD_IDS,
    assets: st.assets,
  });

  return mirrorDocumentDeltaToWasm(state.lastDocument, next);
}
