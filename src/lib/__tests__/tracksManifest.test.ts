import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  integrationTrackRangePattern,
  LATEST_INTEGRATION_TRACK,
} from "@/lib/tracksManifest";

const root = process.cwd();

describe("tracksManifest", () => {
  it("tracks.md lists the latest integration track as complete", () => {
    const doc = readFileSync(join(root, "docs/tracks.md"), "utf8");
    assert.match(doc, new RegExp(`\\*\\*${LATEST_INTEGRATION_TRACK}\\*\\*`));
    assert.match(doc, integrationTrackRangePattern());
    assert.match(doc, /Complete/);
  });

  it("release gate scripts reference the current integration track range", () => {
    const release = readFileSync(join(root, "scripts/verify-release.mjs"), "utf8");
    const ci = readFileSync(join(root, "scripts/verify-ci.mjs"), "utf8");
    const stack = readFileSync(join(root, "scripts/verify-stack.mjs"), "utf8");
    const range = integrationTrackRangePattern();

    assert.match(release, range);
    assert.match(ci, range);
    assert.match(stack, new RegExp(`integration tracks \\(2–${LATEST_INTEGRATION_TRACK}\\)`));
  });

  it("deployment.md references the current offline stack range", () => {
    const doc = readFileSync(join(root, "docs/deployment.md"), "utf8");
    assert.match(doc, integrationTrackRangePattern());
  });
});
