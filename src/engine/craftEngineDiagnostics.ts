import { getActiveCraftEngine, isCraftEngineReady } from "@/engine/craftEngineRegistry";
import { readCraftEngine } from "@/engine/craftEngineMutation";
import { getCraftEngineWasm } from "@/engine/craftEngineLoader";
import { isNativeRendererEnabled } from "@/lib/craftPublicConfig";

export type CraftEngineDiagnostics = {
  ready: boolean;
  backend: string | null;
  version: string | null;
  tileCacheLen: number | null;
  atlasImageCount: number | null;
  canUndo: boolean | null;
  canRedo: boolean | null;
};

let cachedVersion: string | null = null;

async function engineVersion(): Promise<string | null> {
  if (cachedVersion) return cachedVersion;
  try {
    const wasm = await getCraftEngineWasm();
    cachedVersion = wasm.engineVersion?.() ?? null;
    return cachedVersion;
  } catch {
    return null;
  }
}

export async function readCraftEngineDiagnostics(): Promise<CraftEngineDiagnostics> {
  if (!isNativeRendererEnabled()) {
    return {
      ready: false,
      backend: null,
      version: null,
      tileCacheLen: null,
      atlasImageCount: null,
      canUndo: null,
      canRedo: null,
    };
  }

  const engine = getActiveCraftEngine();
  if (!engine || !isCraftEngineReady()) {
    return {
      ready: false,
      backend: null,
      version: await engineVersion(),
      tileCacheLen: null,
      atlasImageCount: null,
      canUndo: null,
      canRedo: null,
    };
  }

  const snapshot = readCraftEngine(
    () => ({
      backend: engine.backendLabel(),
      tileCacheLen: engine.tileCacheLen(),
      atlasImageCount: engine.atlasImageCount(),
      canUndo: engine.canUndo(),
      canRedo: engine.canRedo(),
    }),
    null,
  );

  return {
    ready: true,
    backend: snapshot?.backend ?? null,
    version: await engineVersion(),
    tileCacheLen: snapshot?.tileCacheLen ?? null,
    atlasImageCount: snapshot?.atlasImageCount ?? null,
    canUndo: snapshot?.canUndo ?? null,
    canRedo: snapshot?.canRedo ?? null,
  };
}
