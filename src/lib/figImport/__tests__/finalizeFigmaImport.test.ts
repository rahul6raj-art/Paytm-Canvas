import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatImportToast } from "@/lib/figImport/figImportSummary";

const root = process.cwd();

describe("formatImportToast", () => {
  it("formats success without warning", () => {
    const msg = formatImportToast({
      layerCount: 292,
      rootCount: 12,
      fileName: "Test",
    });
    assert.match(msg, /Test/);
    assert.match(msg, /12 frame/);
    assert.match(msg, /292 layer/);
    assert.equal(msg.includes("not saved"), false);
  });

  it("includes warning when present", () => {
    const msg = formatImportToast({
      layerCount: 100,
      rootCount: 1,
      fileName: "Big",
      warning: "not saved to browser storage",
    });
    assert.match(msg, /not saved/);
  });
});

describe("finalizeFigmaImportToEditor", () => {
  it("keeps figImportInProgress true until the document patch is applied", () => {
    const src = readFileSync(join(root, "src/lib/figImport/finalizeFigmaImport.ts"), "utf8");
    assert.match(src, /settleImportedDocumentUi/);
    assert.match(
      src,
      /figImportInProgress:\s*true[\s\S]*settleImportedDocumentUi[\s\S]*figImportInProgress:\s*false/,
    );
  });

  it("skips heavy post-import work for large documents", () => {
    const src = readFileSync(join(root, "src/lib/figImport/finalizeFigmaImport.ts"), "utf8");
    assert.match(src, /FIG_IMPORT_POST_LAYOUT_NODE_CAP/);
    assert.match(src, /FIG_IMPORT_AUTO_SAVE_NODE_CAP/);
    assert.doesNotMatch(src, /fitCanvasToImportedDocumentWithRetry/);
  });

  it("uses worker-first fast convert path", () => {
    const src = readFileSync(join(root, "src/lib/figImport/convertFigFileAsync.ts"), "utf8");
    assert.match(src, /convertFigBytesInWorker/);
    assert.match(src, /convertFigBytesToPaytmCraft/);
    assert.doesNotMatch(src, /waitForNextPaint/);
  });
});
