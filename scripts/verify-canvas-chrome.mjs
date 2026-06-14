#!/usr/bin/env node
/**
 * Offline verification for Figma-style canvas chrome (Track 26).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:canvas-chrome] canvas chrome regression tests");
run("npm", ["test", "--", "src/lib/__tests__/canvasChrome.test.ts"]);

console.log("[verify:canvas-chrome] ok");
