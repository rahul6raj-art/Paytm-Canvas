#!/usr/bin/env node
/**
 * Cursor afterFileEdit hook — debounced craft-bridge push when a linked source file changes.
 * Requires: craft.link.json in repo root, Craft running, CRAFT_BRIDGE_TOKEN if auth enabled.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBOUNCE_MS = 1200;
const STAMP = path.join(process.cwd(), ".craft-bridge", "hook-debounce.json");

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function manifestPath() {
  return path.join(process.cwd(), "craft.link.json");
}

function isLinkedFile(absPath) {
  if (!existsSync(manifestPath())) return false;
  const manifest = JSON.parse(readFileSync(manifestPath(), "utf8"));
  const repoRoot = path.resolve(process.cwd(), manifest.repoRoot ?? ".");
  const rel = path.relative(repoRoot, absPath).replace(/\\/g, "/");
  if (rel.startsWith("..")) return false;
  return (manifest.links ?? []).some((l) => l.sourcePath.replace(/\\/g, "/") === rel);
}

function resolveBridgeCli() {
  const envCli = process.env.CRAFT_BRIDGE_CLI?.trim();
  if (envCli && existsSync(envCli)) return envCli;
  const local = path.join(process.cwd(), "node_modules", ".bin", "craft-bridge");
  if (existsSync(local)) return local;
  return "node";
}

function schedulePush(sourceRel) {
  mkdirSync(path.dirname(STAMP), { recursive: true });
  writeFileSync(
    STAMP,
    JSON.stringify({ sourceRel, at: Date.now() }, null, 2),
    "utf8",
  );

  const stampMtime = () => (existsSync(STAMP) ? statSync(STAMP).mtimeMs : 0);
  const scheduledAt = stampMtime();

  setTimeout(() => {
    if (!existsSync(STAMP) || statSync(STAMP).mtimeMs !== scheduledAt) return;
    const cli = resolveBridgeCli();
    const args =
      cli === "node"
        ? [
            path.join(process.cwd(), "node_modules", "@paytm-craft/bridge", "cli.mjs"),
            "push",
            sourceRel,
          ]
        : ["push", sourceRel];

    const child = spawn(cli, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
  }, DEBOUNCE_MS);
}

const input = await readStdin();
const filePath =
  input.file_path ??
  input.filePath ??
  input.path ??
  input.editedFile ??
  null;

if (!filePath || typeof filePath !== "string") {
  process.exit(0);
}

const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
if (!isLinkedFile(abs)) {
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath(), "utf8"));
const repoRoot = path.resolve(process.cwd(), manifest.repoRoot ?? ".");
const rel = path.relative(repoRoot, abs).replace(/\\/g, "/");
schedulePush(rel);
process.exit(0);
