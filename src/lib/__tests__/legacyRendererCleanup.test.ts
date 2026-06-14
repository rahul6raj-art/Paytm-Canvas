import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { craftPublicConfigFromEnv } from "@/lib/craftPublicConfig";
import { LEGACY_RENDERER_ENVS } from "@/lib/legacyRendererEnv";

const root = process.cwd();

const REMOVED_PATHS = [
  "src/editor-core/renderer/WebGLTileCompositor.tsx",
  "src/editor-core/renderer/DomSceneRenderer.tsx",
  "src/editor-core/renderer/SvgHitLayer.tsx",
  "src/lib/canvasTiles",
  "scripts/renderer-compare.mjs",
  "scripts/webgl-visual-regression.mjs",
  "scripts/webgl-frame-check.mjs",
  "scripts/webgl-dom-compare.mjs",
];

describe("legacyRendererCleanup", () => {
  it("coerces legacy renderer env values to native", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
    try {
      for (const legacy of LEGACY_RENDERER_ENVS) {
        process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = legacy;
        assert.equal(craftPublicConfigFromEnv().renderer, "native");
      }
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_RENDERER = prev;
    }
  });

  it("SceneRenderer paints SVG scene", () => {
    const src = readFileSync(join(root, "src/editor-core/renderer/SceneRenderer.tsx"), "utf8");
    assert.doesNotMatch(src, /isWebGLRendererEnabled/);
    assert.doesNotMatch(src, /isSvgRendererEnabled/);
    assert.doesNotMatch(src, /DomSceneRenderer/);
    assert.doesNotMatch(src, /SvgHitLayer/);
    assert.match(src, /SvgSceneRenderer/);
  });

  it("Canvas mounts native hit layer at viewport level", () => {
    const src = readFileSync(join(root, "src/components/editor/Canvas.tsx"), "utf8");
    assert.match(src, /NativeHitLayer/);
  });

  it("Canvas mounts native compositor only (no WebGL tile compositor)", () => {
    const src = readFileSync(join(root, "src/components/editor/Canvas.tsx"), "utf8");
    assert.doesNotMatch(src, /WebGLTileCompositor/);
    assert.doesNotMatch(src, /isWebGLRendererEnabled/);
    assert.match(src, /NativeSceneCompositor/);
  });

  it("rendererMode type is native-only", () => {
    const src = readFileSync(join(root, "src/lib/rendererMode.ts"), "utf8");
    assert.match(src, /RendererMode = "native"/);
    assert.doesNotMatch(src, /"webgl"/);
    assert.doesNotMatch(src, /"dom"/);
  });

  it("removed legacy renderer source and scripts (Track 28)", () => {
    for (const rel of REMOVED_PATHS) {
      assert.ok(!existsSync(join(root, rel)), `expected removed: ${rel}`);
    }
  });

  it("canvasEphemeralTransform has no webgl compositor bridge", () => {
    const src = readFileSync(join(root, "src/lib/canvasEphemeralTransform.ts"), "utf8");
    assert.doesNotMatch(src, /webglCompositorBridge/);
    assert.doesNotMatch(src, /canvasTiles/);
  });
});
