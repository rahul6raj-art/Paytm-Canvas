#!/usr/bin/env node
/**
 * Offline verification for Docker stack bundle wiring (Track 35).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:docker-stack-gate] docker stack bundle regression tests");
run("npm", ["test", "--", "src/lib/__tests__/dockerStackGate.test.ts"]);

console.log("[verify:docker-stack-gate] ok");
