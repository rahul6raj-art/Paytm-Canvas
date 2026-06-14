#!/usr/bin/env node
/**
 * Full release verification: integration stack (Tracks 2–36) + native renderer (Track 1).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, npmScript) {
  console.log(`[verify:release] ${label}`);
  const result = spawnSync("npm", ["run", npmScript], { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("integration stack (Tracks 2–36)", "verify:stack");
run("native renderer (Track 1)", "verify:migration");

console.log("[verify:release] ok");
