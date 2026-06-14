#!/usr/bin/env node
/**
 * Offline verification for legacy renderer cleanup (Track 27).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:legacy-cleanup] legacy renderer regression tests");
run("npm", ["test", "--", "src/lib/__tests__/legacyRendererCleanup.test.ts"]);

console.log("[verify:legacy-cleanup] ok");
