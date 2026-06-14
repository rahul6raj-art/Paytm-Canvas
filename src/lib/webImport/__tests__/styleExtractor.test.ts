import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractVisualStyle } from "../styleExtractor";

describe("styleExtractor stroke fidelity", () => {
  it("maps Tailwind ring box-shadow to stroke", () => {
    const style = extractVisualStyle({
      backgroundColor: "rgb(255, 255, 255)",
      boxShadow: "rgb(209, 213, 219) 0px 0px 0px 1px inset",
      borderTopWidth: "0px",
    });
    assert.equal(style.strokeEnabled, true);
    assert.ok((style.strokeWidth ?? 0) >= 1);
    assert.ok(style.strokeColor?.includes("d1d5db") || style.strokeColor === "#d1d5db");
  });

  it("maps outline to stroke when border is absent", () => {
    const style = extractVisualStyle({
      outlineWidth: "2px",
      outlineColor: "rgb(59, 130, 246)",
      outlineStyle: "solid",
    });
    assert.equal(style.strokeWidth, 2);
    assert.equal(style.strokeEnabled, true);
  });
});
