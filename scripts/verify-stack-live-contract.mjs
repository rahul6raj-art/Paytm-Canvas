#!/usr/bin/env node
/**
 * Offline contract tests for live stack smoke helpers (Track 18).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:stack:live:contract] stackLiveChecks tests");
run("npm", ["test", "--", "src/lib/__tests__/stackLiveChecks.test.ts"]);

console.log("[verify:stack:live:contract] apiTokenAuth tests");
run("npm", ["test", "--", "src/lib/__tests__/apiTokenAuth.test.ts"]);

console.log("[verify:stack:live:contract] apiTokenManagement tests");
run("npm", ["test", "--", "src/lib/__tests__/apiTokenManagement.test.ts"]);

console.log("[verify:stack:live:contract] mockApiTokens tests");
run("npm", ["test", "--", "src/lib/__tests__/mockApiTokens.test.ts"]);

console.log("[verify:stack:live:contract] ok");
