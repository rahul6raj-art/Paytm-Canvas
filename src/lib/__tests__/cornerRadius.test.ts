import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampCornerRadii,
  hasIndependentVertexCornerRadii,
  isPerCornerRadiusMode,
  offsetRoundedRectPathD,
  roundedRectPathD,
} from "@/lib/cornerRadius";

describe("cornerRadius/roundedRectPathD", () => {
  it("does not insert spurious edge segments when opposite corners meet", () => {
    const radii = clampCornerRadii([40, 40, 40, 40], 83, 80);
    assert.deepEqual(radii, [40, 40, 40, 40]);

    const d = roundedRectPathD(83, 80, [40, 40, 40, 40]);
    assert.ok(!d.includes("V 80"), `path must not jump across collapsed vertical edge: ${d}`);
    assert.ok(!d.includes("V 0"), `path must not jump across collapsed vertical edge: ${d}`);
    assert.ok(d.includes(" C "), `path uses cubic corners: ${d}`);
    assert.ok(d.endsWith("Z"), d);
  });

  it("does not insert spurious horizontal segments when top corners meet", () => {
    const d = roundedRectPathD(80, 100, [40, 40, 0, 0]);
    assert.ok(!d.includes("H 80"), `path must not span full width when top edge collapsed: ${d}`);
  });

  it("isPerCornerRadiusMode is true when cornerRadii array is stored", () => {
    assert.equal(isPerCornerRadiusMode({ cornerRadii: [0, 0, 0, 0] }), true);
    assert.equal(isPerCornerRadiusMode({ cornerRadius: 8 }), false);
  });

  it("hasIndependentVertexCornerRadii detects mixed per-corner values", () => {
    assert.equal(hasIndependentVertexCornerRadii([8, 8, 8, 8]), false);
    assert.equal(hasIndependentVertexCornerRadii([305, 10, 20, 30]), true);
  });

  it("offsetRoundedRectPathD keeps cubic corners for inset/outset", () => {
    const d = offsetRoundedRectPathD(200, 150, [80, 80, 80, 80], 20);
    assert.ok(d.includes(" C "), d);
    assert.ok(!d.includes(" A "), d);
  });
});
