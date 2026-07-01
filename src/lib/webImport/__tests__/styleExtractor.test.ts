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
    assert.equal(style.effects?.length ?? 0, 0);
  });

  it("maps PML selected-card inset ring to stroke without duplicating inner-shadow", () => {
    const style = extractVisualStyle({
      backgroundColor: "rgb(232, 245, 233)",
      boxShadow: "rgb(52, 163, 77) 0px 0px 0px 1px inset",
      borderTopWidth: "0px",
      borderRadius: "24px",
    });
    assert.equal(style.strokeEnabled, true);
    assert.equal(style.strokeWidth, 1);
    assert.ok(style.strokeColor?.toLowerCase().includes("34a34d") || style.strokeColor?.includes("52, 163, 77"));
    assert.equal(style.effects?.length ?? 0, 0);
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

  it("maps css filter and backdrop-filter to node effects", () => {
    const style = extractVisualStyle({
      filter: "blur(8px)",
      backdropFilter: "blur(12px) saturate(180%)",
    });
    assert.ok(style.effects?.some((e) => e.type === "layer-blur" && e.blur === 8));
    const backdrop = style.effects?.find((e) => e.type === "background-blur");
    assert.ok(backdrop);
    assert.equal(backdrop?.blur, 12);
    assert.equal(backdrop?.saturation, 180);
  });

  it("parses radial-gradient circle shape without treating circle as a color stop", () => {
    const style = extractVisualStyle({
      backgroundImage:
        "radial-gradient(circle, rgba(0, 200, 83, 0.35) 0%, rgba(0, 200, 83, 0.15) 40%, rgba(0, 200, 83, 0) 70%)",
    });
    assert.equal(style.fillType, "gradient");
    assert.ok(style.fillGradient);
    assert.equal(style.fillGradient?.stops.length, 3);
    assert.notEqual(style.fillGradient?.stops[0]?.color, "circle");
    assert.ok((style.fillGradient?.stops[0]?.opacity ?? 1) < 1);
    assert.equal(style.fillGradient?.stops[2]?.opacity, 0);
  });
});
