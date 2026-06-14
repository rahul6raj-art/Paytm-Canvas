#!/usr/bin/env node
/**
 * Unified offline verification for integration tracks (2–36).
 * Does not run Rust/WASM checks — use verify:migration or test:all for renderer work.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, npmScript) {
  console.log(`[verify:stack] ${label}`);
  const result = spawnSync("npm", ["run", npmScript], { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("persistence (Track 2)", "verify:persistence");
run("remote + backend (Tracks 4–6)", "verify:remote");
run("deploy manifests (Track 16)", "verify:deploy");
run("production deploy kit (Track 25)", "verify:production");
run("canvas chrome (Track 26)", "verify:canvas-chrome");
run("legacy renderer cleanup (Track 27)", "verify:legacy-cleanup");
run("CI release gate wiring (Track 29)", "verify:ci-gate");
run("API contracts (Track 30)", "verify:api-contracts");
run("tracks manifest sync (Track 31)", "verify:tracks-sync");
run("editor smoke gate (Track 32)", "verify:editor-gate");
run("live stack smoke gate (Track 33)", "verify:stack-live-gate");
run("migration verify gate (Track 34)", "verify:migration-gate");
run("docker stack gate (Track 35)", "verify:docker-stack-gate");
run("live stack contract (Track 18)", "verify:stack:live:contract");
run("tracks index (Track 22)", "verify:tracks");
run("release stack gate (Track 36)", "verify:release-stack-gate");

console.log("[verify:stack] ok");
