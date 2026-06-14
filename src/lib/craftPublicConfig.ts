import { isLegacyRendererEnv } from "@/lib/legacyRendererEnv";
import type { RendererMode } from "@/lib/rendererMode";

export type CraftPublicConfig = {
  renderer: RendererMode;
  wasmAuthority?: boolean;
  /** When true (default with WASM authority), Zustand mirrors WASM snapshots only. */
  wasmUiMirror?: boolean;
  /** When true (default with UI mirror), structural edits apply to WASM before the store. */
  wasmFirstMutations?: boolean;
};

declare global {
  interface Window {
    __CRAFT_PUBLIC_CONFIG__?: CraftPublicConfig;
  }
}

function readEnvString(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function rendererFromString(raw: string): RendererMode {
  if (raw === "native" || raw === "") return "native";
  if (isLegacyRendererEnv(raw)) return "native";
  return "native";
}

/** Server/build-time config from env (also used to seed `window.__CRAFT_PUBLIC_CONFIG__`). */
function wasmAuthorityFromEnv(renderer: RendererMode): boolean {
  if (renderer !== "native") return false;
  const raw = readEnvString("NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY");
  if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
  return true;
}

function wasmUiMirrorFromEnv(renderer: RendererMode, wasmAuthority: boolean): boolean {
  if (!wasmAuthority || renderer !== "native") return false;
  const raw = readEnvString("NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR");
  if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
  return true;
}

function wasmFirstMutationsFromEnv(
  renderer: RendererMode,
  wasmAuthority: boolean,
  wasmUiMirror: boolean,
): boolean {
  if (!wasmAuthority || !wasmUiMirror || renderer !== "native") return false;
  const raw = readEnvString("NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS");
  if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
  return true;
}

export function craftPublicConfigFromEnv(): CraftPublicConfig {
  const renderer = rendererFromString(readEnvString("NEXT_PUBLIC_PAYTM_CRAFT_RENDERER"));
  const wasmAuthority = wasmAuthorityFromEnv(renderer);
  const wasmUiMirror = wasmUiMirrorFromEnv(renderer, wasmAuthority);
  return {
    renderer,
    wasmAuthority,
    wasmUiMirror,
    wasmFirstMutations: wasmFirstMutationsFromEnv(renderer, wasmAuthority, wasmUiMirror),
  };
}

/** Browser-safe config: prefers runtime injection from root layout script. */
export function getCraftPublicConfig(): CraftPublicConfig {
  if (typeof window !== "undefined" && window.__CRAFT_PUBLIC_CONFIG__?.renderer) {
    return window.__CRAFT_PUBLIC_CONFIG__;
  }
  return craftPublicConfigFromEnv();
}

export function getRendererMode(): RendererMode {
  return getCraftPublicConfig().renderer;
}

export function isNativeRendererEnabled(): boolean {
  return getRendererMode() === "native";
}

export function isWasmDocumentAuthorityEnabled(): boolean {
  const cfg = getCraftPublicConfig();
  return cfg.renderer === "native" && cfg.wasmAuthority === true;
}

export function isWasmUiMirrorModeEnabled(): boolean {
  const cfg = getCraftPublicConfig();
  if (cfg.renderer !== "native" || cfg.wasmAuthority !== true) return false;
  return cfg.wasmUiMirror !== false;
}

export function isWasmFirstMutationsEnabled(): boolean {
  const cfg = getCraftPublicConfig();
  if (cfg.renderer !== "native" || cfg.wasmAuthority !== true || cfg.wasmUiMirror === false) {
    return false;
  }
  return cfg.wasmFirstMutations !== false;
}
