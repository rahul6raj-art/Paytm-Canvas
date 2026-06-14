import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultFillGradient,
  effectiveFillType,
  fillPaintCss,
  gradientInspectorBarPaintCss,
  gradientAngleDeg,
  insertStopAtPosition,
  normalizeFillGradient,
  reverseGradientStops,
  setGradientAngle,
} from "@/lib/fillGradient";
import { gradientTAtLocal } from "@/lib/gradient/handles";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

describe("gradient engine", () => {
  it("detects gradient fill type with two or more stops", () => {
    const g = defaultFillGradient("#cdff82");
    assert.equal(effectiveFillType({ fillType: "gradient", fillGradient: g }), "gradient");
    assert.equal(effectiveFillType({ fillType: "gradient", fillGradient: { ...g, stops: [] } }), "solid");
  });

  it("detects image, video, and pattern fill types", () => {
    assert.equal(effectiveFillType({ fillType: "image", fillImageAssetId: "a1" }), "image");
    assert.equal(effectiveFillType({ fillType: "video", fillVideoAssetId: "v1" }), "video");
    assert.equal(effectiveFillType({ fillType: "pattern", fillPatternAssetId: "p1" }), "pattern");
    assert.equal(effectiveFillType({ fillPatternAssetId: "legacy" }), "pattern");
  });

  it("renders CSS linear gradient paint", () => {
    const g = defaultFillGradient("#cdff82", "linear");
    const css = fillPaintCss({ fillType: "gradient", fillGradient: g, fillEnabled: true, fillOpacity: 1 });
    assert.match(css, /linear-gradient/i);
    assert.match(css, /#cdff82/i);
  });

  it("inspector ramp shows stop colors", () => {
    const g = defaultFillGradient("#cdff82");
    const bar = gradientInspectorBarPaintCss(g, 1);
    assert.match(bar, /linear-gradient/i);
  });

  it("inserts interpolated stop on ramp click", () => {
    const g = defaultFillGradient("#111111");
    g.stops = [
      { id: "a", color: "#cdff82", position: 0 },
      { id: "b", color: "#000000", position: 100 },
    ];
    const next = insertStopAtPosition(g, 50);
    assert.equal(next.stops.length, 3);
    const mid = next.stops.find((s) => s.position === 50);
    assert.ok(mid);
    assert.notEqual(mid.color, "#cdff82");
    assert.notEqual(mid.color, "#000000");
  });

  it("reverses stop positions without swapping handles", () => {
    const g = defaultFillGradient("#ff0000", "linear");
    g.stops = [
      { id: "a", color: "#ff0000", opacity: 1, position: 0 },
      { id: "b", color: "#0000ff", opacity: 1, position: 100 },
    ];
    const rev = reverseGradientStops(g);
    assert.equal(rev.handles[0]?.x, g.handles[0]?.x);
    assert.equal(rev.handles[1]?.x, g.handles[1]?.x);
    assert.equal(rev.stops.find((s) => s.id === "a")?.position, 100);
    assert.equal(rev.stops.find((s) => s.id === "b")?.position, 0);
    const sorted = [...rev.stops].sort((a, b) => a.position - b.position);
    assert.equal(sorted[0]?.color, "#0000ff");
    assert.equal(sorted[sorted.length - 1]?.color, "#ff0000");
  });

  it("sets linear gradient angle via handles", () => {
    const g = defaultFillGradient("#111", "linear");
    const angled = setGradientAngle(g, 45);
    assert.ok(Math.abs(gradientAngleDeg(angled) - 45) <= 2);
  });

  it("sets angular gradient rotation via reference handle", () => {
    const g = defaultFillGradient("#111", "angular");
    const rotated = setGradientAngle(g, 120);
    assert.ok(Math.abs(gradientAngleDeg(rotated) - 120) <= 2);
  });

  it("diamond and angular sampling differ at corners", () => {
    const g = defaultFillGradient("#111", "angular");
    const handles = g.handles;
    const angularCorner = gradientTAtLocal("angular", 1, 1, handles);
    const diamondCorner = gradientTAtLocal("diamond", 1, 1, handles);
    assert.notEqual(angularCorner, diamondCorner);
  });

  it("normalizes legacy angle-only gradients", () => {
    const legacy = normalizeFillGradient({
      type: "linear",
      angle: 90,
      stops: [
        { id: "s1", color: "#fff", position: 0 },
        { id: "s2", color: "#000", position: 100 },
      ],
    });
    assert.equal(legacy.kind, "linear");
    assert.equal(legacy.handles.length, 3);
  });

  it("prefers local fillGradient over linked gradient token when rendering", () => {
    const tokenGradient = defaultFillGradient("#111111", "linear");
    const localGradient = defaultFillGradient("#803225", "linear");
    localGradient.stops[0]!.position = 47.8;
    const node = {
      id: "n1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fillType: "gradient",
      fillTokenId: "tok-grad",
      fillGradient: localGradient,
    } as EditorNode;
    const resolved = resolveNodeWithDesignTokens(node, {
      "tok-grad": {
        id: "tok-grad",
        name: "Brand",
        type: "gradient",
        value: tokenGradient,
      },
    });
    assert.equal(resolved.fillGradient?.stops[0]?.position, 47.8);
    assert.equal(resolved.fillGradient?.stops[0]?.color, "#803225");
  });
});
