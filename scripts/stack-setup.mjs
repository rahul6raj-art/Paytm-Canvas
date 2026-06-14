#!/usr/bin/env node
/**
 * Bootstrap Postgres schema, seed data, and MinIO bucket for the local stack.
 * Run after `npm run stack:up` (or `npm run db:up` for infra-only).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, script) {
  console.log(`[stack:setup] ${label}`);
  const result = spawnSync("node", [script], { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("database migrate + seed", "scripts/db-setup.mjs");
run("object storage bucket", "scripts/storage-setup.mjs");

console.log("[stack:setup] ok");
console.log("[stack:setup] API: http://localhost:4000/v1");
console.log("[stack:setup] Sync: ws://localhost:4001/yjs");
