/** Selectors checked by `npm run verify:editor` (Playwright smoke). */
export const EDITOR_SMOKE_SELECTORS = {
  viewport: "[data-canvas-viewport]",
  nativeCompositor: "[data-native-scene-compositor]",
  engineReadyAttr: "data-engine-ready",
  gpuBackendAttr: "data-gpu-backend",
} as const;

export const EDITOR_SMOKE_GOLDEN_FIXTURE = "fixtures/golden-tile-scene.json";

/** Canvas chrome markers expected on a loaded editor page (Track 26). */
export const EDITOR_CANVAS_CHROME_MARKERS = [
  "data-canvas-tool-rail",
  "data-shape-draw-preview",
  "data-selection-inspector-tools",
] as const;

export const EDITOR_SMOKE_SCRIPT = "scripts/verify-native-editor.mjs";

export const EDITOR_SMOKE_SCRIPT_MARKERS = [
  "data-canvas-viewport",
  "data-native-scene-compositor",
  "data-engine-ready",
  "golden-tile-scene.json",
  "chromium",
] as const;
