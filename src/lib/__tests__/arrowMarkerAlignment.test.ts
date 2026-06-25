import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrowChevronMarkerPathD, arrowFilledTriangleMarkerPathD } from "@/lib/shapes/arrowGeometry";
import { strokeEndpointMarkerDefs } from "@/lib/strokeEndpoints";

describe("arrow marker alignment", () => {
  it("line-arrow marker refX sits on chevron tip", () => {
    const s = 8 * 1.8;
    const chevron = arrowChevronMarkerPathD(s);
    const defs = strokeEndpointMarkerDefs(
      "pc-test",
      "none",
      "line-arrow",
      "#ffffff",
      8,
      { markerScale: 1 },
    );
    assert.match(defs, new RegExp(`refX="${chevron.refX}"`));
    assert.match(defs, new RegExp(`refY="${chevron.refY}"`));
    assert.match(defs, new RegExp(` L ${chevron.refX} ${chevron.refY} `));
    assert.match(defs, /stroke-width="8"/);
    assert.match(defs, /stroke-linecap="round"/);
  });

  it("triangle-arrow marker refX sits on head tip", () => {
    const s = 8 * 1.8;
    const head = arrowFilledTriangleMarkerPathD(s);
    const defs = strokeEndpointMarkerDefs(
      "pc-test",
      "none",
      "triangle-arrow",
      "#ffffff",
      8,
      { markerScale: 1 },
    );
    assert.match(defs, new RegExp(`refX="${head.refX}"`));
    assert.match(defs, new RegExp(` L ${head.refX} ${head.refY} `));
  });
});
