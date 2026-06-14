import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSinglePageJpegPdf } from "@/lib/pdfExport";

describe("buildSinglePageJpegPdf", () => {
  it("writes a minimal valid PDF envelope", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildSinglePageJpegPdf(jpeg, 120, 80);
    const text = new TextDecoder().decode(pdf);
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.ok(text.includes("/Filter /DCTDecode"));
    assert.ok(text.endsWith("%%EOF\n"));
  });
});
