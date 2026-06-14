#!/usr/bin/env node
/**
 * Debug real web import — dumps scene stats and common failure patterns.
 * Usage: node scripts/debug-web-import.mjs [url]
 */
import { runImportWebCapture } from "../src/lib/webImport/server/playwrightCaptureService.ts";

const url = process.argv[2] ?? "https://uxmagic.ai";

const res = await runImportWebCapture({
  url,
  urlPolicy: "public",
  mode: "editable",
  viewport: { width: 1440, height: 900 },
});

function walkScene(node, depth = 0) {
  const rows = [];
  const pad = "  ".repeat(depth);
  const extras = [];
  if (node.fillEnabled) extras.push(`fill=${node.fill?.slice(0, 24)}`);
  if (node.strokeEnabled) extras.push(`stroke=${node.strokeWidth}`);
  if (node.layoutMode && node.layoutMode !== "none") extras.push(`layout=${node.layoutMode}`);
  if (node.content) extras.push(`text="${node.content.slice(0, 40)}"`);
  if (node.imageSrc) extras.push("image");
  rows.push(
    `${pad}${node.type} "${node.name}" ${Math.round(node.width)}×${Math.round(node.height)} @${Math.round(node.x)},${Math.round(node.y)} ${extras.join(" ")}`,
  );
  for (const c of node.children ?? []) rows.push(...walkScene(c, depth + 1));
  return rows;
}

const stats = { frame: 0, text: 0, image: 0, path: 0, rectangle: 0, withStroke: 0, withFill: 0, withLayout: 0 };
function count(node) {
  stats[node.type] = (stats[node.type] ?? 0) + 1;
  if (node.strokeEnabled) stats.withStroke++;
  if (node.fillEnabled) stats.withFill++;
  if (node.layoutMode && node.layoutMode !== "none") stats.withLayout++;
  for (const c of node.children ?? []) count(c);
}
count(res.scene);

console.log("URL:", url);
console.log("Page:", res.page.width, "×", res.page.height);
console.log("Fidelity:", res.fidelity);
console.log("Stats:", stats);
console.log("Assets:", Object.keys(res.assets).length);
console.log("\n--- Scene tree (first 80 lines) ---");
const lines = walkScene(res.scene);
console.log(lines.slice(0, 80).join("\n"));
if (lines.length > 80) console.log(`... ${lines.length - 80} more nodes`);

const texts = [];
function collectText(n) {
  if (n.type === "text" && n.content) texts.push(n.content);
  for (const c of n.children ?? []) collectText(c);
}
collectText(res.scene);
console.log("\n--- Text layers ---");
for (const t of texts.slice(0, 30)) console.log(" ", JSON.stringify(t));
if (texts.length > 30) console.log(`  ... ${texts.length - 30} more`);
