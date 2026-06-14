#!/usr/bin/env node
import { runImportWebCapture } from "../src/lib/webImport/server/playwrightCaptureService.ts";
import { importWebResponseToPersistSlice } from "../src/lib/webImport/webImportToPersistSlice.ts";
import { relayoutDirtyTree, markLayoutDirty } from "../src/lib/layoutEngine/dirty.ts";
import { toLayoutMap, mergeLayoutMapIntoNodes } from "../src/lib/autoLayout.ts";

const res = await runImportWebCapture({
  url: "https://uxmagic.ai/signup",
  urlPolicy: "public",
  mode: "editable",
  viewport: { width: 1440, height: 900 },
});
const slice = importWebResponseToPersistSlice(res);
let nodes = { ...slice.nodes };
const childOrder = { ...slice.childOrder };

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

const before = worldPos(
  Object.values(nodes).find((n) => n.content === "Continue with Email")!.id,
);

let layoutMap = toLayoutMap(nodes);
for (const n of Object.values(nodes)) {
  if ((n.layoutMode ?? "none") !== "none") {
    layoutMap = markLayoutDirty(layoutMap, n.id);
  }
}
layoutMap = relayoutDirtyTree(layoutMap, childOrder, Object.keys(nodes));
nodes = mergeLayoutMapIntoNodes(nodes, layoutMap);

const after = worldPos(
  Object.values(nodes).find((n) => n.content === "Continue with Email")!.id,
);

console.log("Email button label world before:", before);
console.log("Email button label world after relayout:", after);
