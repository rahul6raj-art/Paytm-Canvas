import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  wasmSnapshotToStorePatch,
  type WasmSnapshotStorePatch,
} from "@/engine/craftEngineSnapshotApply";
import { getActiveCraftEngine, requestCraftEngineForceFullSync } from "@/engine/craftEngineRegistry";
import {
  readCraftEngine,
  runCraftEngineAccess,
} from "@/engine/craftEngineMutation";

export function craftEngineAuthorityCanUndo(): boolean {
  if (!isWasmDocumentAuthority()) return false;
  const engine = getActiveCraftEngine();
  if (!engine) return false;
  return readCraftEngine(() => engine.canUndo(), false);
}

export function craftEngineAuthorityCanRedo(): boolean {
  if (!isWasmDocumentAuthority()) return false;
  const engine = getActiveCraftEngine();
  if (!engine) return false;
  return readCraftEngine(() => engine.canRedo(), false);
}

export function craftEngineAuthorityPushSnapshot(): void {
  if (!isWasmDocumentAuthority()) return;
  runCraftEngineAccess(() => {
    try {
      getActiveCraftEngine()?.pushHistorySnapshot();
    } catch {
      /* engine not ready */
    }
  });
}

export function craftEngineAuthorityUndo(): WasmSnapshotStorePatch | null {
  if (!isWasmDocumentAuthority()) return null;
  const engine = getActiveCraftEngine();
  if (!engine) return null;

  let patch: WasmSnapshotStorePatch | null = null;
  runCraftEngineAccess(() => {
    try {
      if (!engine.canUndo()) return;
      engine.undo();
      const json = engine.snapshotDocument();
      if (!json) return;
      patch = wasmSnapshotToStorePatch(json);
      if (patch) requestCraftEngineForceFullSync();
    } catch {
      patch = null;
    }
  });
  return patch;
}

export function craftEngineAuthorityRedo(): WasmSnapshotStorePatch | null {
  if (!isWasmDocumentAuthority()) return null;
  const engine = getActiveCraftEngine();
  if (!engine) return null;

  let patch: WasmSnapshotStorePatch | null = null;
  runCraftEngineAccess(() => {
    try {
      if (!engine.canRedo()) return;
      engine.redo();
      const json = engine.snapshotDocument();
      if (!json) return;
      patch = wasmSnapshotToStorePatch(json);
      if (patch) requestCraftEngineForceFullSync();
    } catch {
      patch = null;
    }
  });
  return patch;
}
