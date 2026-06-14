#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const fixture = join(root, "fixtures/golden-tile-scene.json");
const checksumPath = join(root, "fixtures/golden-tile-scene.native.sha256");
const renderBin = join(root, "packages/craft-engine/target/release/craft-render");

if (!existsSync(renderBin)) {
  console.log("[verify:golden] skip — craft-render not built (npm run build:engine)");
  process.exit(0);
}

const outDir = mkdtempSync(join(tmpdir(), "craft-golden-"));
const outPng = join(outDir, "golden.png");

const result = spawnSync(renderBin, [fixture, outPng], { encoding: "utf8" });
if (result.status !== 0) {
  console.error("[verify:golden] craft-render failed");
  if (result.stdout) console.error(result.stdout);
  if (result.stderr) console.error(result.stderr);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

const size = statSync(outPng).size;
if (size < 1000) {
  console.error(`[verify:golden] PNG too small (${size} bytes)`);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

const actual = createHash("sha256").update(readFileSync(outPng)).digest("hex");
const expected = readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
if (actual !== expected) {
  console.error("[verify:golden] PNG checksum mismatch");
  console.error("  expected:", expected);
  console.error("  actual:  ", actual);
  console.error("  Re-run craft-render and update fixtures/golden-tile-scene.native.sha256 if intentional.");
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
console.log("[verify:golden] ok", { pngBytes: size, sha256: actual, fixture });
