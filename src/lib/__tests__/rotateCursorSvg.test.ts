import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRotateCursorSvg } from "@/lib/rotateCursorSvg";

describe("rotateCursorSvg", () => {
  it("embeds tldraw rotate paths in a 32×32 viewBox", () => {
    const svg = buildRotateCursorSvg(0);
    assert.match(svg, /viewBox="0 0 32 32"/);
    assert.match(svg, /M22\.4789 9\.45728/);
    assert.match(svg, /fill-rule='evenodd'/);
  });

  it("rotates around the cursor hotspot", () => {
    assert.match(buildRotateCursorSvg(90), /rotate\(90 16 16\)/);
  });
});
