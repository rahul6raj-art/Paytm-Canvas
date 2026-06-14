import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  LIVE_STACK_CONTRACT_SCRIPT,
  LIVE_STACK_ENV_KEYS,
  LIVE_STACK_SCRIPT,
  LIVE_STACK_SCRIPT_MARKERS,
} from "@/lib/stackLiveManifest";

const root = process.cwd();

describe("stackLiveGate", () => {
  it("live stack script exists and covers auth, REST, and websocket join", () => {
    assert.ok(existsSync(join(root, LIVE_STACK_SCRIPT)));
    const script = readFileSync(join(root, LIVE_STACK_SCRIPT), "utf8");
    for (const marker of LIVE_STACK_SCRIPT_MARKERS) {
      assert.match(script, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("offline contract runner is wired for verify:stack", () => {
    assert.ok(existsSync(join(root, LIVE_STACK_CONTRACT_SCRIPT)));
    const contract = readFileSync(join(root, LIVE_STACK_CONTRACT_SCRIPT), "utf8");
    assert.match(contract, /stackLiveChecks/);
    const stack = readFileSync(join(root, "scripts/verify-stack.mjs"), "utf8");
    assert.match(stack, /verify:stack:live:contract/);
  });

  it("live-stack-track documents env keys", () => {
    const doc = readFileSync(join(root, "docs/live-stack-track.md"), "utf8");
    for (const key of LIVE_STACK_ENV_KEYS) {
      assert.match(doc, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(doc, /\(planned\)/);
  });

  it("package.json exposes verify:stack:live", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.ok(pkg.scripts?.["verify:stack:live"]);
    assert.ok(pkg.scripts?.["verify:stack:live:contract"]);
    assert.match(pkg.scripts!["verify:stack:live"]!, /verify-stack-live/);
  });
});
