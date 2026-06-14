#!/usr/bin/env node
/**
 * Offline verification for live stack smoke wiring (Track 33).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:stack-live-gate] live stack smoke regression tests");
run("npm", ["test", "--", "src/lib/__tests__/stackLiveGate.test.ts"]);

console.log("[verify:stack-live-gate] ok");
