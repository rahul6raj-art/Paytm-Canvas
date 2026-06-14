import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ENGINE_VERIFY_SCRIPT,
  GOLDEN_REGRESSION_TESTS,
  GOLDEN_SCENE_CHECKSUM,
  GOLDEN_SCENE_FIXTURE,
  GOLDEN_VERIFY_SCRIPT,
  MIGRATION_VERIFY_SCRIPT,
  MIGRATION_VERIFY_SCRIPT_MARKERS,
  WASM_PUBLIC_ARTIFACTS,
} from "@/lib/migrationVerifyManifest";

const root = process.cwd();

describe("migrationVerifyGate", () => {
  it("verify:migration chains tests, engine artifacts, and golden render", () => {
    assert.ok(existsSync(join(root, MIGRATION_VERIFY_SCRIPT)));
    const script = readFileSync(join(root, MIGRATION_VERIFY_SCRIPT), "utf8");
    for (const marker of MIGRATION_VERIFY_SCRIPT_MARKERS) {
      assert.match(script, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("engine and golden verify scripts exist", () => {
    assert.ok(existsSync(join(root, ENGINE_VERIFY_SCRIPT)));
    assert.ok(existsSync(join(root, GOLDEN_VERIFY_SCRIPT)));
    const engine = readFileSync(join(root, ENGINE_VERIFY_SCRIPT), "utf8");
    assert.match(engine, /craft_engine_bg\.wasm/);
    const golden = readFileSync(join(root, GOLDEN_VERIFY_SCRIPT), "utf8");
    assert.match(golden, /golden-tile-scene\.json/);
    assert.match(golden, /golden-tile-scene\.native\.sha256/);
  });

  it("golden fixture and checksum are present", () => {
    assert.ok(existsSync(join(root, GOLDEN_SCENE_FIXTURE)));
    assert.ok(existsSync(join(root, GOLDEN_SCENE_CHECKSUM)));
    for (const rel of WASM_PUBLIC_ARTIFACTS) {
      assert.ok(existsSync(join(root, rel)), `missing wasm artifact ${rel}`);
    }
  });

  it("golden regression tests exist", () => {
    for (const rel of GOLDEN_REGRESSION_TESTS) {
      assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
    }
  });

  it("verify:release includes native migration step", () => {
    const release = readFileSync(join(root, "scripts/verify-release.mjs"), "utf8");
    assert.match(release, /verify:migration/);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.ok(pkg.scripts?.["verify:migration"]);
    assert.ok(pkg.scripts?.["verify:engine"]);
    assert.ok(pkg.scripts?.["verify:golden"]);
  });
});
