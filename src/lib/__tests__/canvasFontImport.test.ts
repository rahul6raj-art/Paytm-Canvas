import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAcceptCanvasFontDrop,
  collectFontFilesFromDataTransfer,
} from "@/lib/canvasFontImport";

describe("canvasFontImport", () => {
  it("detects font file drops", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "Brand.ttf", { type: "font/ttf" });
    const dt = {
      types: ["Files"],
      files: [file],
      items: [{ kind: "file", type: "font/ttf", getAsFile: () => file }],
    } as unknown as DataTransfer;
    assert.equal(canAcceptCanvasFontDrop(dt), true);
    const out = collectFontFilesFromDataTransfer(dt);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.name, "Brand.ttf");
  });

  it("rejects non-font file drops", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    const dt = {
      types: ["Files"],
      files: [file],
      items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
    } as unknown as DataTransfer;
    assert.equal(canAcceptCanvasFontDrop(dt), false);
    assert.equal(collectFontFilesFromDataTransfer(dt).length, 0);
  });
});
