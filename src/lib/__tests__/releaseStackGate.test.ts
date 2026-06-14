import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  RELEASE_VERIFY_MARKERS,
  RELEASE_VERIFY_SCRIPT,
  STACK_VERIFY_SCRIPT,
  STACK_VERIFY_SCRIPTS,
} from "@/lib/releaseStackManifest";
import { integrationTrackRangePattern, LATEST_INTEGRATION_TRACK } from "@/lib/tracksManifest";

const root = process.cwd();

describe("releaseStackGate", () => {
  it("verify:stack invokes every integration verify script", () => {
    assert.ok(existsSync(join(root, STACK_VERIFY_SCRIPT)));
    const stack = readFileSync(join(root, STACK_VERIFY_SCRIPT), "utf8");
    for (const script of STACK_VERIFY_SCRIPTS) {
      assert.match(
        stack,
        new RegExp(`,\\s*"${script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`),
        `verify:stack missing ${script}`,
      );
    }
    assert.match(stack, new RegExp(`integration tracks \\(2–${LATEST_INTEGRATION_TRACK}\\)`));
  });

  it("verify:release chains integration stack and native migration", () => {
    assert.ok(existsSync(join(root, RELEASE_VERIFY_SCRIPT)));
    const release = readFileSync(join(root, RELEASE_VERIFY_SCRIPT), "utf8");
    for (const marker of RELEASE_VERIFY_MARKERS) {
      assert.match(release, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(release, integrationTrackRangePattern());
  });

  it("tracks index documents the release ladder", () => {
    const doc = readFileSync(join(root, "docs/tracks.md"), "utf8");
    assert.match(doc, /verify:stack/);
    assert.match(doc, /verify:release/);
    assert.match(doc, /verify:release-stack-gate/);
    assert.match(doc, /release-stack-gate-track/);
    assert.match(doc, integrationTrackRangePattern());
  });

  it("package.json exposes stack and release verify scripts", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.ok(pkg.scripts?.["verify:stack"]);
    assert.ok(pkg.scripts?.["verify:release"]);
    assert.ok(pkg.scripts?.["verify:release-stack-gate"]);
    for (const script of STACK_VERIFY_SCRIPTS) {
      assert.ok(pkg.scripts?.[script], `missing npm script ${script}`);
    }
  });
});
