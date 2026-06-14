import type { CraftEngineSyncState } from "@/engine/craftEngineIncrementalSync";
import type { CraftEngineInstance } from "@/engine/craftEngineTypes";

let activeEngine: CraftEngineInstance | null = null;
let activeSyncState: CraftEngineSyncState | null = null;
let forceFullNextSync = false;
let wasmBootstrapRequested = false;

export function requestCraftEngineForceFullSync(): void {
  forceFullNextSync = true;
}

/** Request loadDocument + pushHistorySnapshot on the next compositor sync (WASM authority). */
export function requestCraftEngineWasmBootstrap(): void {
  wasmBootstrapRequested = true;
}

export function consumeCraftEngineWasmBootstrap(): boolean {
  const v = wasmBootstrapRequested;
  wasmBootstrapRequested = false;
  return v;
}

export function consumeCraftEngineForceFullSync(): boolean {
  const v = forceFullNextSync;
  forceFullNextSync = false;
  return v;
}

export function registerCraftEngine(engine: CraftEngineInstance | null): void {
  activeEngine = engine;
}

/** Register compositor incremental-sync baseline (WASM geometry authority). */
export function registerCraftEngineSyncState(state: CraftEngineSyncState | null): void {
  activeSyncState = state;
}

export function getCraftEngineSyncState(): CraftEngineSyncState | null {
  return activeSyncState;
}

export function isCraftEngineReady(): boolean {
  return activeEngine != null;
}

export function getActiveCraftEngine(): CraftEngineInstance | null {
  return activeEngine;
}

/** Deepest paintable node at world coordinates via WASM (undefined if engine not ready). */
export function craftEngineHitTest(worldX: number, worldY: number): string | undefined {
  if (!activeEngine) return undefined;
  try {
    return activeEngine.hitTest(worldX, worldY);
  } catch {
    return undefined;
  }
}
