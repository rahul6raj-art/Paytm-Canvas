#!/usr/bin/env node
import { runImportWebCapture } from "../src/lib/webImport/server/playwrightCaptureService.ts";
import { importWebResponseToPersistSlice } from "../src/lib/webImport/webImportToPersistSlice.ts";

const res = await runImportWebCapture({
  url: "https://uxmagic.ai/signup",
  urlPolicy: "public",
  mode: "editable",
  viewport: { width: 1440, height: 900 },
});
const { nodes, childOrder } = importWebResponseToPersistSlice(res);

function chain(id) {
  const parts = [];
  let cur = id;
  while (cur && nodes[cur]) {
    parts.push(`${nodes[cur].type}:${nodes[cur].name}@(${nodes[cur].x},${nodes[cur].y})`);
    cur = nodes[cur].parentId;
  }
  return parts.reverse().join(" > ");
}

const firstName = Object.values(nodes).find((n) => n.type === "text" && n.content === "First Name" && n.parentId && nodes[n.parentId]?.name === "Input");
if (firstName) {
  console.log("First Name label chain:");
  console.log(chain(firstName.id));
}

// Check childOrder vs parentId consistency
let mismatches = 0;
for (const [pid, kids] of Object.entries(childOrder)) {
  if (pid === "__root__") continue;
  for (const cid of kids) {
    const c = nodes[cid];
    if (!c) { mismatches++; continue; }
    if (c.parentId !== pid && pid !== "__root__") {
      mismatches++;
      if (mismatches <= 5) console.log("MISMATCH", cid, "parentId", c.parentId, "childOrder key", pid);
    }
  }
}
console.log("parentId mismatches:", mismatches);

// Orphan nodes
const inChildOrder = new Set();
for (const kids of Object.values(childOrder)) kids.forEach((id) => inChildOrder.add(id));
const orphans = Object.values(nodes).filter((n) => n.parentId && !inChildOrder.has(n.id));
console.log("orphans (have parentId but not in childOrder):", orphans.length);
