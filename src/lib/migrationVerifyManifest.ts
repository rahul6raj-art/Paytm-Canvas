/** Track 1 native renderer offline verification bundle (see verify:migration). */
export const MIGRATION_VERIFY_SCRIPT = "scripts/verify-migration.mjs";

export const ENGINE_VERIFY_SCRIPT = "scripts/verify-craft-engine-artifacts.mjs";

export const GOLDEN_VERIFY_SCRIPT = "scripts/verify-golden-native-render.mjs";

export const GOLDEN_SCENE_FIXTURE = "fixtures/golden-tile-scene.json";

export const GOLDEN_SCENE_CHECKSUM = "fixtures/golden-tile-scene.native.sha256";

export const WASM_PUBLIC_ARTIFACTS = [
  "public/craft-engine/craft_engine.js",
  "public/craft-engine/craft_engine_bg.wasm",
  "public/craft-engine/craft_engine.d.ts",
] as const;

export const MIGRATION_VERIFY_SCRIPT_MARKERS = [
  'run("npm", ["test"])',
  "verify:engine",
  "verify:golden",
] as const;

export const GOLDEN_REGRESSION_TESTS = [
  "src/lib/__tests__/goldenTileSceneHit.test.ts",
  "src/lib/__tests__/goldenTileSceneCraftEngine.test.ts",
] as const;
