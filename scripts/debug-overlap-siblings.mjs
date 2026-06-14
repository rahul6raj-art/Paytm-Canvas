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

function texts(id, acc = []) {
  const n = nodes[id];
  if (!n) return acc;
  if (n.type === "text" && n.content) acc.push(n.content);
  for (const cid of childOrder[id] ?? []) texts(cid, acc);
  return acc;
}

for (const [pid, kids] of Object.entries(childOrder)) {
  const atOrigin = kids.filter((id) => nodes[id]?.x === 0 && nodes[id]?.y === 0);
  if (atOrigin.length >= 2) {
    const parent = nodes[pid];
    console.log(
      `parent "${parent?.name}" kids@0,0: ${atOrigin.length} layout=${parent?.layoutMode} gap=${parent?.layoutGap}`,
    );
    for (const id of atOrigin) {
      const n = nodes[id];
      console.log(
        `  ${n.type} "${n.name}" ${n.width}x${n.height} layout=${n.layoutMode} pos=${n.layoutPositioning}`,
        texts(id).slice(0, 6).join(" | "),
      );
    }
  }
}
