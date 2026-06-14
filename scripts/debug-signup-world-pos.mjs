#!/usr/bin/env node
import { runImportWebCapture } from "../src/lib/webImport/server/playwrightCaptureService.ts";
import { importWebResponseToPersistSlice } from "../src/lib/webImport/webImportToPersistSlice.ts";

const res = await runImportWebCapture({
  url: "https://uxmagic.ai/signup",
  urlPolicy: "public",
  mode: "editable",
  viewport: { width: 1440, height: 900 },
});
const slice = importWebResponseToPersistSlice(res);
const { nodes, childOrder } = slice;

function worldPos(id) {
  let x = nodes[id].x;
  let y = nodes[id].y;
  let p = nodes[id].parentId;
  while (p && nodes[p]) {
    x += nodes[p].x;
    y += nodes[p].y;
    p = nodes[p].parentId;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

const texts = Object.values(nodes).filter((n) => n.type === "text" && n.content);
console.log("Text count:", texts.length);
for (const t of texts) {
  const w = worldPos(t.id);
  const parent = t.parentId ? nodes[t.parentId] : null;
  console.log(
    JSON.stringify({
      content: t.content?.slice(0, 40),
      local: [Math.round(t.x), Math.round(t.y)],
      world: [w.x, w.y],
      parent: parent?.name,
      parentLayout: parent?.layoutMode ?? "none",
      parentType: parent?.type,
    }),
  );
}

const alFrames = Object.values(nodes).filter((n) => (n.layoutMode ?? "none") !== "none");
console.log("\nAuto-layout frames:", alFrames.length);

const rootId = childOrder["__root__"]?.[0] ?? Object.keys(childOrder).find((k) => childOrder[k]?.includes && childOrder[k].length === 1);
const pageRoot = childOrder["__root__"]?.[0];
if (pageRoot) {
  const r = nodes[pageRoot];
  console.log("\nPage root:", r?.name, r?.x, r?.y, r?.width, r?.height);
}
