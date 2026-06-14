#!/usr/bin/env node
/**
 * Smoke-test the native editor in a browser (requires dev server).
 *
 *   npm run dev
 *   npm run verify:editor
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.CRAFT_EDITOR_URL ?? "http://localhost:3000/editor";
const fixturePath = join(root, "fixtures/golden-tile-scene.json");

async function serverReachable() {
  try {
    const base = url.replace(/\/editor\/?$/, "") || "http://localhost:3000";
    const res = await fetch(base, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function seedGoldenDocument(page) {
  if (!existsSync(fixturePath)) return false;
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  await page.evaluate((doc) => {
    localStorage.setItem(
      "paytm-craft-document-v1",
      JSON.stringify({
        nodes: doc.nodes,
        childOrder: doc.childOrder,
        pages: [{ id: "page-1", name: "Page 1" }],
        currentPageId: "page-1",
      }),
    );
  }, fixture);
  return true;
}

if (!(await serverReachable())) {
  console.log("[verify:editor] skip — dev server not reachable at", url);
  console.log("[verify:editor] start with: npm run dev");
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`PAGE: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
const seeded = await seedGoldenDocument(page);
if (seeded) await page.reload({ waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => ({
  viewport: Boolean(document.querySelector("[data-canvas-viewport]")),
  native: Boolean(document.querySelector("[data-native-scene-compositor]")),
  nativeReady:
    document.querySelector("[data-native-scene-compositor]")?.getAttribute("data-engine-ready") ===
    "true",
  gpuBackend:
    document.querySelector("[data-native-scene-compositor]")?.getAttribute("data-gpu-backend") ??
    null,
}));

await browser.close();

let failed = false;
if (!info.viewport) {
  console.error("[verify:editor] canvas viewport not mounted");
  failed = true;
}
if (!info.native) {
  console.error("[verify:editor] native compositor not mounted (check NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=native)");
  failed = true;
}
if (!info.nativeReady) {
  console.error("[verify:editor] native compositor not ready after 6s");
  failed = true;
}
if (errors.length > 0) {
  console.error("[verify:editor] console/page errors:");
  for (const e of errors) console.error(" ", e);
  failed = true;
}

if (failed) process.exit(1);

console.log("[verify:editor] ok", { url, seeded, ...info });
