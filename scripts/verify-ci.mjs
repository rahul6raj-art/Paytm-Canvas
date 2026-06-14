#!/usr/bin/env node
/**
 * CI release gate (Track 29): Rust checks + full verify:release.
 * Requires Rust toolchain (same as GitHub Actions).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, cmd, args) {
  console.log(`[verify:ci] ${label}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("Rust unit tests (craft-engine)", "npm", ["run", "build:engine:check"]);
run("Headless native renderer binary", "cargo", [
  "build",
  "--release",
  "--manifest-path",
  "packages/craft-engine/Cargo.toml",
  "--bin",
  "craft-render",
]);
run("full release gate (Tracks 2–36 + Track 1)", "npm", ["run", "verify:release"]);

console.log("[verify:ci] ok");
