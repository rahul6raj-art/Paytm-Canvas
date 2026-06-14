#!/usr/bin/env node
/**
 * Apply Prisma migrations and seed the local Postgres database.
 * Requires: `npm run db:up` and DATABASE_URL (see packages/craft-api/.env.example).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "packages/craft-api");
const envExample = join(apiDir, ".env.example");
const envFile = join(apiDir, ".env");

if (!existsSync(envFile) && existsSync(envExample)) {
  copyFileSync(envExample, envFile);
  console.log("[db:setup] created packages/craft-api/.env from .env.example");
}

const realtimeDir = join(root, "packages/craft-realtime");
const realtimeEnvExample = join(realtimeDir, ".env.example");
const realtimeEnvFile = join(realtimeDir, ".env");
if (!existsSync(realtimeEnvFile) && existsSync(realtimeEnvExample)) {
  copyFileSync(realtimeEnvExample, realtimeEnvFile);
  console.log("[db:setup] created packages/craft-realtime/.env from .env.example");
}

function run(label, cmd, args, cwd = apiDir) {
  console.log(`[db:setup] ${label}`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", encoding: "utf8", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("prisma generate", "npx", ["prisma", "generate"]);
run("prisma migrate deploy", "npx", ["prisma", "migrate", "deploy"]);
run("prisma db seed", "npx", ["prisma", "db", "seed"]);

console.log("[db:setup] ok");
