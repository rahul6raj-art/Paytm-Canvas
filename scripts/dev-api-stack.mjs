#!/usr/bin/env node
/**
 * Dev stack: mock Yjs relay + Next.js in api mode with disk-backed mock API store.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {
  ...process.env,
  PAYTM_CRAFT_MOCK_API_PERSIST: "1",
  NEXT_PUBLIC_PAYTM_CRAFT_MODE: "api",
  NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL: "ws://localhost:3001/yjs",
};

const children = [];

function spawnChild(label, cmd, args) {
  const child = spawn(cmd, args, { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev:api] ${label} stopped (${signal})`);
    } else if (code && code !== 0) {
      console.error(`[dev:api] ${label} exited with code ${code}`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev:api] mock Yjs relay on ws://localhost:3001/yjs");
console.log("[dev:api] mock API store → .craft-mock-api/store.json");
spawnChild("sync", "node", ["scripts/mock-yjs-sync-server.mjs"]);
spawnChild("web", "npm", ["run", "dev"]);
