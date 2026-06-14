#!/usr/bin/env node
/**
 * Offline backend scaffold verification (no Docker required).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:backend] craft-api unit tests");
run("npm", ["run", "test", "-w", "@paytm-craft/api"]);

console.log("[verify:backend] craft-realtime unit tests");
run("npm", ["run", "test", "-w", "@paytm-craft/realtime"]);

console.log("[verify:backend] ok");
