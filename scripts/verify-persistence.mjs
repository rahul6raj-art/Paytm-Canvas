#!/usr/bin/env node
/**
 * Offline persistence-track verification (no browser required).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const persistencePattern =
  "apiSyncProvider|apiFileHydration|mockApiStoreRevision|mockApiStorePersistence|paytmCraftEnv|yjsDocumentChannel|realtimeSyncProtocol";

console.log("[verify:persistence] Track 2 regression tests");
run("npm", ["test", "--", `--test-name-pattern=${persistencePattern}`]);

console.log("[verify:persistence] ok");
