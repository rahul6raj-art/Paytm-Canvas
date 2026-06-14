import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractImgSrcFromHtml,
  imageFilesFromClipboard,
  isLikelyImageUrl,
} from "@/lib/canvasImageImport";

describe("canvasImageImport", () => {
  it("detects likely image URLs", () => {
    assert.equal(isLikelyImageUrl("https://example.com/photo.png"), true);
    assert.equal(isLikelyImageUrl("data:image/png;base64,abc"), true);
    assert.equal(isLikelyImageUrl("https://example.com/page"), false);
  });

  it("extracts img src from HTML drag payload", () => {
    const html = '<meta><img src="https://cdn.example.com/a.webp" alt="">';
    assert.equal(extractImgSrcFromHtml(html), "https://cdn.example.com/a.webp");
  });

  it("reads image files from clipboard data", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const dt = {
      files: [file],
      items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
    } as unknown as DataTransfer;
    const out = imageFilesFromClipboard(dt);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.name, "shot.png");
  });
});
