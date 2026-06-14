import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  EDITOR_CANVAS_CHROME_MARKERS,
  EDITOR_SMOKE_GOLDEN_FIXTURE,
  EDITOR_SMOKE_SCRIPT,
  EDITOR_SMOKE_SCRIPT_MARKERS,
  EDITOR_SMOKE_SELECTORS,
} from "@/lib/editorSmokeManifest";

const root = process.cwd();

describe("editorSmokeGate", () => {
  it("native compositor exposes smoke-test data attributes", () => {
    const src = readFileSync(
      join(root, "src/editor-core/renderer/NativeSceneCompositor.tsx"),
      "utf8",
    );
    assert.match(src, /data-native-scene-compositor/);
    assert.match(src, /data-engine-ready/);
    assert.match(src, /data-gpu-backend/);
  });

  it("canvas mounts viewport and Track 26 chrome", () => {
    const canvas = readFileSync(join(root, "src/components/editor/Canvas.tsx"), "utf8");
    const appShell = readFileSync(join(root, "src/components/editor/AppShell.tsx"), "utf8");
    assert.match(canvas, /data-canvas-viewport/);
    assert.match(appShell, /CanvasToolRail/);
    assert.match(canvas, /ShapeDrawPreview/);
    for (const marker of EDITOR_CANVAS_CHROME_MARKERS) {
      const component =
        marker === "data-canvas-tool-rail"
          ? "CanvasToolRail.tsx"
          : marker === "data-shape-draw-preview"
            ? "ShapeDrawPreview.tsx"
            : "SelectionInspectorTools.tsx";
      const src = readFileSync(join(root, "src/components/editor", component), "utf8");
      assert.match(src, new RegExp(marker));
    }
  });

  it("verify:editor script checks native compositor selectors", () => {
    assert.ok(existsSync(join(root, EDITOR_SMOKE_SCRIPT)));
    const script = readFileSync(join(root, EDITOR_SMOKE_SCRIPT), "utf8");
    for (const marker of EDITOR_SMOKE_SCRIPT_MARKERS) {
      assert.match(script, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(script, new RegExp(EDITOR_SMOKE_SELECTORS.viewport.replace(/[[\]]/g, "\\$&")));
  });

  it("golden fixture exists for editor seeding", () => {
    assert.ok(existsSync(join(root, EDITOR_SMOKE_GOLDEN_FIXTURE)));
  });

  it("package.json exposes verify:editor", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.ok(pkg.scripts?.["verify:editor"]);
    assert.match(pkg.scripts!["verify:editor"]!, /verify-native-editor/);
  });

  it("removed orphaned check-editor.mjs script", () => {
    assert.ok(!existsSync(join(root, "scripts/check-editor.mjs")));
  });
});
