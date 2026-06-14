#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "craft-engine");
const required = ["craft_engine.js", "craft_engine_bg.wasm", "craft_engine.d.ts"];

function readEngineVersion() {
  const libRs = fs.readFileSync(path.join(root, "packages/craft-engine/src/lib.rs"), "utf8");
  const match = libRs.match(/engine_version\(\)[^"]*"(\d+\.\d+\.\d+)"/s);
  return match?.[1] ?? null;
}

let missing = false;
for (const file of required) {
  const full = path.join(outDir, file);
  if (!fs.existsSync(full)) {
    console.error(`[verify:engine] missing ${full}`);
    missing = true;
    continue;
  }
  const size = fs.statSync(full).size;
  if (size === 0) {
    console.error(`[verify:engine] empty ${full}`);
    missing = true;
  }
}

const wasmPath = path.join(outDir, "craft_engine_bg.wasm");
if (fs.existsSync(wasmPath)) {
  const wasmSize = fs.statSync(wasmPath).size;
  if (wasmSize < 500_000) {
    console.error(`[verify:engine] wasm suspiciously small (${wasmSize} bytes)`);
    missing = true;
  }
}

const version = readEngineVersion();
if (!version) {
  console.error("[verify:engine] could not read engine_version from lib.rs");
  missing = true;
}

if (missing) {
  console.error("[verify:engine] run: npm run build:engine");
  process.exit(1);
}

console.log("[verify:engine] ok", { outDir, version });
