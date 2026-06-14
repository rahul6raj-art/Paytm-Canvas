import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dashFromSvgStrokeDasharray } from "@/lib/svgImport/parseDashArray";
import { importSvgSourceToEditorGraph } from "@/lib/svgImport";
import { isMaskGroup } from "@/lib/booleanGeometry";

describe("svgImport features", () => {
  it("maps stroke-dasharray to editor dash fields", () => {
    const dash = dashFromSvgStrokeDasharray("8 4");
    assert.equal(dash?.strokeStyle, "dashed");
    assert.equal(dash?.strokeDashLength, 8);
    assert.equal(dash?.strokeDashGap, 4);
  });

  it("imports clipPath as mask group geometry", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="c"><rect x="10" y="10" width="30" height="30"/></clipPath>
      </defs>
      <g clip-path="url(#c)">
        <rect x="0" y="0" width="50" height="50" fill="#f00"/>
      </g>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "clip.svg");
    assert.ok(result);
    const maskGroup = Object.values(result.nodes).find((n) => isMaskGroup(n));
    assert.ok(maskGroup?.maskId);
    const mask = result.nodes[maskGroup.maskId!];
    assert.equal(mask?.isMask, true);
    assert.ok(mask?.pathPoints && mask.pathPoints.length >= 3);
  });

  it("ignores stroke gradient url and keeps solid stroke", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff0000"/>
          <stop offset="100%" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" fill="#fff" stroke="url(#sg)" stroke-width="4"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "stroke-grad.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.notEqual(rect?.strokeType, "gradient");
    assert.equal(rect?.strokeWidth, 4);
  });

  it("imports pattern fill as tiled asset", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#00aa00"/>
        </pattern>
      </defs>
      <rect width="50" height="50" fill="url(#p)"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "pattern.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.ok(rect?.fillPatternAssetId);
    assert.ok(result.assets[rect!.fillPatternAssetId!]);
  });

  it("imports feGaussianBlur as layer effect", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="b"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <rect width="40" height="40" fill="#000" filter="url(#b)"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "blur.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.ok(rect?.effects?.some((e) => e.type === "layer-blur"));
  });

  it("imports multiple tspans as separate text nodes", () => {
    const source = `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="20" font-size="16" fill="#000">
        <tspan x="10" y="20">Hello</tspan>
        <tspan x="10" y="40">World</tspan>
      </text>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "tspan.svg");
    assert.ok(result);
    const texts = Object.values(result.nodes).filter((n) => n.type === "text");
    assert.equal(texts.length, 2);
    assert.deepEqual(texts.map((t) => t.content).sort(), ["Hello", "World"]);
  });
});
