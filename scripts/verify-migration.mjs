#!/usr/bin/env node
/**
 * Offline migration verification (no browser required).
 * Runs TS tests, WASM artifact check, and golden native PNG checksum.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:migration] TypeScript tests");
run("npm", ["test"]);

console.log("[verify:migration] WASM artifacts");
run("npm", ["run", "verify:engine"]);

console.log("[verify:migration] Golden native render");
run("npm", ["run", "verify:golden"]);

console.log("[verify:migration] ok");
