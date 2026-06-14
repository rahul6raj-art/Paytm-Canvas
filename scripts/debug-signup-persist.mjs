#!/usr/bin/env node
/** Dump persisted editor nodes after signup import for layout debugging. */
import { runImportWebCapture } from "../src/lib/webImport/server/playwrightCaptureService.ts";
import { importWebResponseToPersistSlice } from "../src/lib/webImport/webImportToPersistSlice.ts";

const res = await runImportWebCapture({
  url: "https://uxmagic.ai/signup",
  urlPolicy: "public",
  mode: "editable",
  viewport: { width: 1440, height: 900 },
});

const slice = importWebResponseToPersistSlice(res);
const nodes = slice.nodes;
const childOrder = slice.childOrder;

const rootId = childOrder["__root__"]?.[0] ?? childOrder["editor-root"]?.[0];
console.log("root:", rootId, rootId && nodes[rootId]?.width, "x", rootId && nodes[rootId]?.height);

function walk(id, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return;
  const n = nodes[id];
  if (!n) return;
  const pad = "  ".repeat(depth);
  const extras = [];
  if (n.fillEnabled) extras.push(`fill=${(n.fill ?? "").slice(0, 20)}`);
  if (n.layoutMode && n.layoutMode !== "none") extras.push(`layout=${n.layoutMode}`);
  if (n.content) extras.push(`"${n.content.slice(0, 30)}"`);
  if (n.type === "text" && (childOrder[id]?.length ?? 0) > 0) extras.push("⚠️TEXT_HAS_CHILDREN");
  console.log(
    `${pad}${n.type} "${n.name}" ${Math.round(n.width)}×${Math.round(n.height)} @${Math.round(n.x)},${Math.round(n.y)} vis=${n.visible} ${extras.join(" ")}`,
  );
  for (const cid of childOrder[id] ?? []) walk(cid, depth + 1, maxDepth);
}

if (rootId) {
  for (const cid of childOrder[rootId] ?? []) walk(cid, 0);
}

const textWithKids = Object.values(nodes).filter(
  (n) => n.type === "text" && (childOrder[n.id]?.length ?? 0) > 0,
);
console.log("\nText nodes with children:", textWithKids.length);
for (const t of textWithKids.slice(0, 10)) {
  console.log(`  ${t.name}: "${t.content}" kids=${childOrder[t.id]?.length}`);
}
