import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorFontAsset } from "@/lib/documentPersistence";
import {
  findUploadedFontAsset,
  uploadedFontOptionsFromAssets,
} from "@/lib/fonts/uploadedFonts";

function asset(id: string, family: string, weight: number): EditorFontAsset {
  return {
    id,
    family,
    weight,
    fileName: `${family}.ttf`,
    mimeType: "font/ttf",
    dataUrl: "data:font/ttf;base64,AA==",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("uploadedFonts", () => {
  it("builds catalog options from font assets", () => {
    const opts = uploadedFontOptionsFromAssets({
      a: asset("a", "Brand Sans", 400),
      b: asset("b", "Brand Sans", 700),
    });
    assert.equal(opts.length, 1);
    assert.equal(opts[0]?.source, "uploaded");
    assert.equal(opts[0]?.primary, "Brand Sans");
  });

  it("finds closest weight match", () => {
    const fonts = {
      a: asset("a", "Brand Sans", 400),
      b: asset("b", "Brand Sans", 700),
    };
    assert.equal(findUploadedFontAsset(fonts, "Brand Sans", 700)?.id, "b");
    assert.equal(findUploadedFontAsset(fonts, "Brand Sans", 500)?.id, "a");
  });
});
