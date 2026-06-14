import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("ciReleaseGate", () => {
  it("GitHub Actions workflow runs verify:ci", () => {
    const ciPath = join(root, ".github/workflows/ci.yml");
    assert.ok(existsSync(ciPath));
    const ci = readFileSync(ciPath, "utf8");
    assert.match(ci, /verify:ci/);
    assert.doesNotMatch(ci, /Tracks 2–6/);
    assert.doesNotMatch(ci, /Tracks 1 \+ 2–35/);
    assert.match(ci, /verify:release|Tracks 1 \+ 2–36/);
  });

  it("verify:ci script chains Rust checks and verify:release", () => {
    const scriptPath = join(root, "scripts/verify-ci.mjs");
    assert.ok(existsSync(scriptPath));
    const script = readFileSync(scriptPath, "utf8");
    assert.match(script, /build:engine:check/);
    assert.match(script, /craft-render/);
    assert.match(script, /verify:release/);
  });

  it("verify:release covers integration stack and native migration", () => {
    const scriptPath = join(root, "scripts/verify-release.mjs");
    const script = readFileSync(scriptPath, "utf8");
    assert.match(script, /verify:stack/);
    assert.match(script, /verify:migration/);
    assert.match(script, /Tracks 2–36/);
  });

  it("package.json exposes verify:ci", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.ok(pkg.scripts?.["verify:ci"]);
    assert.ok(pkg.scripts?.["verify:release"]);
  });
});
