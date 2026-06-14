import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fillGradientFromFigmaPaint,
  gradientFillFieldsFromPaints,
} from "@/lib/figImport/figmaGradientPaint";
import { designTokensFromFigmaVariables } from "@/integrations/figma/figma-token-parser";
import { primaryFillFromPaints } from "@/integrations/figma/figma-style-parser";

describe("figmaGradientPaint", () => {
  it("preserves linear gradient stops and handles", () => {
    const fillGradient = fillGradientFromFigmaPaint({
      type: "GRADIENT_LINEAR",
      visible: true,
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ],
      gradientHandlePositions: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 0, y: 1 },
      ],
    });
    assert.ok(fillGradient);
    assert.equal(fillGradient!.kind, "linear");
    assert.equal(fillGradient!.stops.length, 2);
    assert.equal(fillGradient!.stops[0]!.color, "#ff0000");
    assert.equal(fillGradient!.stops[1]!.color, "#0000ff");
    assert.equal(fillGradient!.handles[0]!.x, 0);
    assert.equal(fillGradient!.handles[1]!.x, 1);
  });

  it("returns gradient fill fields from paint stack", () => {
    const fields = gradientFillFieldsFromPaints([
      { type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 } },
      {
        type: "GRADIENT_RADIAL",
        visible: true,
        gradientStops: [
          { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
        ],
        gradientHandlePositions: [
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0 },
          { x: 1, y: 0.5 },
        ],
      },
    ]);
    assert.equal(fields.fillType, "gradient");
    assert.equal(fields.fillGradient?.kind, "radial");
  });
});

describe("figma token import", () => {
  it("maps Figma color variables to design tokens by variable id", () => {
    const bundle = designTokensFromFigmaVariables({
      variables: {
        "VariableID:1:0": {
          name: "primary",
          resolvedType: "COLOR",
          valuesByMode: {
            "1:0": { r: 0.1, g: 0.2, b: 0.3, a: 1 },
          },
        },
      },
    });
    assert.equal(Object.keys(bundle.designTokens).length, 1);
    const token = Object.values(bundle.designTokens)[0]!;
    assert.equal(token.type, "color");
    assert.equal(token.name, "primary");
    assert.equal(bundle.variableIdToTokenId.get("VariableID:1:0"), token.id);
  });

  it("prefers gradient fills over solid paints", () => {
    const fill = primaryFillFromPaints([
      { type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0, a: 1 } },
      {
        type: "GRADIENT_LINEAR",
        visible: true,
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
        ],
        gradientHandlePositions: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 0, y: 1 },
        ],
      },
    ]);
    assert.equal(fill.fillType, "gradient");
    assert.equal(fill.fillGradient?.stops[0]!.color, "#ff0000");
  });
});
