/** Keep in sync with `engine_version()` in packages/craft-engine/src/lib.rs */
export const CRAFT_ENGINE_VERSION = "3.44.0";

/** Skip WASM document tessellation above this — large SVG imports can trap the GPU engine. */
export const CRAFT_ENGINE_SYNC_NODE_CAP = 2_500;

export function readEngineVersionFromLibRs(libRs: string): string | null {
  const match = libRs.match(/engine_version\(\)[^"]*"(\d+\.\d+\.\d+)"/s);
  return match?.[1] ?? null;
}
