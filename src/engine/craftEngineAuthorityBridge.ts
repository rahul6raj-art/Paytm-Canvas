import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  wasmSnapshotToStorePatch,
  type WasmSnapshotStorePatch,
} from "@/engine/craftEngineSnapshotApply";
import { getActiveCraftEngine, requestCraftEngineForceFullSync } from "@/engine/craftEngineRegistry";

export function craftEngineAuthorityCanUndo(): boolean {
  if (!isWasmDocumentAuthority()) return false;
  return getActiveCraftEngine()?.canUndo() ?? false;
}

export function craftEngineAuthorityCanRedo(): boolean {
  if (!isWasmDocumentAuthority()) return false;
  return getActiveCraftEngine()?.canRedo() ?? false;
}

export function craftEngineAuthorityPushSnapshot(): void {
  if (!isWasmDocumentAuthority()) return;
  try {
    getActiveCraftEngine()?.pushHistorySnapshot();
  } catch {
    /* engine not ready */
  }
}

export function craftEngineAuthorityUndo(): WasmSnapshotStorePatch | null {
  if (!isWasmDocumentAuthority()) return null;
  const engine = getActiveCraftEngine();
  if (!engine?.canUndo()) return null;
  try {
    engine.undo();
    const json = engine.snapshotDocument();
    if (!json) return null;
    const patch = wasmSnapshotToStorePatch(json);
    if (!patch) return null;
    requestCraftEngineForceFullSync();
    return patch;
  } catch {
    return null;
  }
}

export function craftEngineAuthorityRedo(): WasmSnapshotStorePatch | null {
  if (!isWasmDocumentAuthority()) return null;
  const engine = getActiveCraftEngine();
  if (!engine?.canRedo()) return null;
  try {
    engine.redo();
    const json = engine.snapshotDocument();
    if (!json) return null;
    const patch = wasmSnapshotToStorePatch(json);
    if (!patch) return null;
    requestCraftEngineForceFullSync();
    return patch;
  } catch {
    return null;
  }
}
