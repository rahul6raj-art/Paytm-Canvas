#!/usr/bin/env node
/**
 * Component authoring UX regression tests (Figma-like flows).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:component-ux] component UX regression tests");
run("npx", [
  "tsx",
  "--test",
  "src/lib/__tests__/componentUx.test.ts",
  "src/lib/__tests__/componentUxFlows.test.ts",
  "src/lib/__tests__/containerSelection.test.ts",
  "src/lib/__tests__/componentSystem.test.ts",
]);

console.log("[verify:component-ux] ok");
