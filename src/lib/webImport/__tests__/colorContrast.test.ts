import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, ensureReadableTextColor, parseRgb } from "../colorContrast";

describe("colorContrast", () => {
  it("parses hex and rgb colors", () => {
    assert.deepEqual(parseRgb("#fff"), { r: 255, g: 255, b: 255 });
    assert.deepEqual(parseRgb("#0a0a0a"), { r: 10, g: 10, b: 10 });
    assert.deepEqual(parseRgb("rgb(37, 99, 235)"), { r: 37, g: 99, b: 235 });
    assert.deepEqual(parseRgb("rgba(0, 0, 0, 0.5)"), { r: 0, g: 0, b: 0 });
    assert.equal(parseRgb("not-a-color"), null);
  });

  it("computes high contrast for black on white", () => {
    assert.ok(contrastRatio("#000000", "#ffffff") > 20);
  });

  it("flips invisible dark-on-dark label to white", () => {
    // Black text on a near-black button (the broken Phone button case).
    const fixed = ensureReadableTextColor("rgb(10, 10, 10)", "rgb(10, 10, 10)");
    assert.equal(fixed, "#ffffff");
  });

  it("keeps a legible label unchanged", () => {
    const fixed = ensureReadableTextColor("#ffffff", "rgb(37, 99, 235)");
    assert.equal(fixed, "#ffffff");
  });

  it("returns original color when background is unknown", () => {
    assert.equal(ensureReadableTextColor("rgb(10, 10, 10)", undefined), "rgb(10, 10, 10)");
  });
});
