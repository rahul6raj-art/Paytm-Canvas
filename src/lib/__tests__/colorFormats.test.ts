import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  colorToCssString,
  fillCss,
  hexToHsl,
  hexToHsv,
  hslToRgb,
  parseCssColor,
  rgbToHex,
  rgbToHsl,
} from "@/lib/color";

describe("color format helpers", () => {
  it("round-trips hex through rgb", () => {
    assert.equal(rgbToHex(217, 217, 217), "#d9d9d9");
  });

  it("converts hex to hsl and back", () => {
    const hsl = hexToHsl("#d9d9d9");
    assert.equal(hsl.h, 0);
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    assert.equal(rgbToHex(rgb.r, rgb.g, rgb.b), "#d9d9d9");
  });

  it("hsb matches hsv for gray", () => {
    const hsv = hexToHsv("#d9d9d9");
    assert.equal(Math.round(hsv.s * 100), 0);
    assert.equal(Math.round(hsv.v * 100), 85);
  });

  it("formats css rgba with alpha", () => {
    assert.equal(colorToCssString("#d9d9d9", 0.5), "rgba(217, 217, 217, 0.5)");
    assert.equal(colorToCssString("#d9d9d9", 1), "#d9d9d9");
  });

  it("parses css rgba", () => {
    const parsed = parseCssColor("rgba(217, 217, 217, 0.5)");
    assert.equal(parsed?.hex, "#d9d9d9");
    assert.equal(parsed?.opacity, 0.5);
  });

  it("fillCss renders rgb() colors from browser extraction", () => {
    assert.equal(fillCss("rgb(13, 68, 191)", 1, true), "#0d44bf");
    assert.equal(fillCss("rgb(244, 244, 245)", 1, true), "#f4f4f5");
    assert.equal(fillCss("rgba(10, 10, 10, 0.8)", 1, true), "rgba(10,10,10,0.8)");
  });
});
