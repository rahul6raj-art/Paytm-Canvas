#!/usr/bin/env node
/**
 * Dev stack: Docker Postgres + craft-api + Next.js in remote mode.
 * Requires Docker Desktop (or docker CLI) for `npm run db:up`.
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const webEnv = {
  ...process.env,
  NEXT_PUBLIC_PAYTM_CRAFT_MODE: "remote",
  NEXT_PUBLIC_PAYTM_CRAFT_API_URL: "http://localhost:4000/v1",
  NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL: "ws://localhost:4001/yjs",
  NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL: "http://localhost:9000/craft-assets",
};

const children = [];

function runSync(label, cmd, args, cwd = root) {
  console.log(`[dev:remote] ${label}`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function spawnChild(label, cmd, args, env = process.env) {
  const child = spawn(cmd, args, { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev:remote] ${label} stopped (${signal})`);
    } else if (code && code !== 0) {
      console.error(`[dev:remote] ${label} exited with code ${code}`);
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

const dockerCheck = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
if (dockerCheck.status !== 0) {
  console.error("[dev:remote] Docker is required. Install Docker Desktop, then retry.");
  process.exit(1);
}

runSync("starting Postgres + Redis + MinIO", "docker", ["compose", "up", "-d", "postgres", "redis", "minio"]);
runSync("db setup", "node", ["scripts/db-setup.mjs"]);
runSync("storage setup", "node", ["scripts/storage-setup.mjs"]);

console.log("[dev:remote] craft-api on http://localhost:4000/v1");
console.log("[dev:remote] craft-realtime on ws://localhost:4001/yjs");
console.log("[dev:remote] Next.js in remote mode on http://localhost:3000");
spawnChild("api", "npm", ["run", "api:dev"]);
spawnChild("sync", "npm", ["run", "sync:dev"]);
spawnChild("web", "npm", ["run", "dev"], webEnv);
