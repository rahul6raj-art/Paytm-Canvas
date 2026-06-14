import type { CraftEngineSyncState } from "@/engine/craftEngineIncrementalSync";
import { createCraftEngineSyncState } from "@/engine/craftEngineIncrementalSync";

/** Reset incremental sync baseline after editor undo/redo. */
export function resetCraftEngineSyncAfterHistory(state: CraftEngineSyncState): {
  state: CraftEngineSyncState;
  forceFull: true;
} {
  return {
    state: createCraftEngineSyncState(),
    forceFull: true,
  };
}
