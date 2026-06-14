#!/usr/bin/env node
/**
 * Offline remote-client integration verification (no Docker/browser).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const remotePattern =
  "remoteAssetDocument|resolveImageAssetImport|remoteAuthSession|apiSyncProvider|paytmCraftEnv|dashboardTeamApi|workspaceTeamInvite|teamsApi|teamAccess|dashboardTeamGrouping|craft-api config|craft-realtime config|inviteEmail";

console.log("[verify:remote] Track 5 client regression tests");
run("npm", ["test", "--", `--test-name-pattern=${remotePattern}`]);

console.log("[verify:remote] team switcher (Track 17)");
run("npm", ["test", "--", "src/lib/__tests__/dashboardTeamSwitcher.test.ts"]);

console.log("[verify:remote] backend scaffold");
run("npm", ["run", "verify:backend"]);

console.log("[verify:remote] ok");
