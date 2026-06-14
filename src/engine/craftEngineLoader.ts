import type { CraftEngineInstance, CraftEngineWasm } from "@/engine/craftEngineTypes";
import { CRAFT_ENGINE_VERSION } from "@/engine/craftEngineVersion";

let initPromise: Promise<CraftEngineWasm> | null = null;

const WASM_BASE = "/craft-engine";

function versionedAsset(path: string): string {
  return `${path}?v=${encodeURIComponent(CRAFT_ENGINE_VERSION)}`;
}

async function loadWasmModule(): Promise<CraftEngineWasm> {
  if (typeof window === "undefined") {
    throw new Error("craft-engine WASM can only load in the browser");
  }

  const jsUrl = versionedAsset(`${WASM_BASE}/craft_engine.js`);
  const wasmUrl = versionedAsset(`${WASM_BASE}/craft_engine_bg.wasm`);

  const mod = (await import(/* webpackIgnore: true */ jsUrl)) as CraftEngineWasm;

  if (typeof mod.default === "function") {
    try {
      await mod.default(wasmUrl);
    } catch {
      await mod.default();
    }
  }

  return mod;
}

export async function getCraftEngineWasm(): Promise<CraftEngineWasm> {
  if (!initPromise) {
    initPromise = loadWasmModule().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function createCraftEngine(canvas: HTMLCanvasElement): Promise<CraftEngineInstance> {
  const wasm = await getCraftEngineWasm();
  return wasm.CraftEngine.create(canvas);
}

export function resetCraftEngineLoader(): void {
  initPromise = null;
}
