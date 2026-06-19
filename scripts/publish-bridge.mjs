#!/usr/bin/env node
/**
 * Prepare @paytm-craft/bridge for npm publish (runs tests + dry-run pack).
 * Usage: node scripts/publish-bridge.mjs [--publish]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publish = process.argv.includes("--publish");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("==> @paytm-craft/bridge pre-publish checks\n");
run("npm", ["run", "test", "-w", "@paytm-craft/bridge"]);
run("npm", ["run", "pack:check", "-w", "@paytm-craft/bridge"]);

if (publish) {
  console.log("\n==> Publishing to npm registry…\n");
  run("npm", ["publish", "-w", "@paytm-craft/bridge", "--access", "public"]);
  console.log("\nPublished @paytm-craft/bridge");
} else {
  console.log(`
Ready to publish. When logged in to npm:

  npm login
  node scripts/publish-bridge.mjs --publish

Or from packages/craft-bridge:

  npm publish --access public
`);
}
