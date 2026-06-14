import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTransformList } from "@/lib/svgImport/parseTransform";
import { applyMatrixToPoint } from "@/lib/transformMath";

describe("parseTransformList", () => {
  it("parses rotate(angle cx cy) around a center point", () => {
    const m = parseTransformList("rotate(90 50 50)");
    const rotated = applyMatrixToPoint(m, { x: 60, y: 50 });
    assert.ok(Math.abs(rotated.x - 50) < 0.01);
    assert.ok(Math.abs(rotated.y - 60) < 0.01);
  });

  it("parses transforms from illustration-style rotate strings", () => {
    const warnings: string[] = [];
    const m = parseTransformList("rotate(11.7457 25.1901 59.8493)", warnings);
    assert.equal(warnings.length, 0);
    assert.notEqual(m.a, 1);
    assert.notEqual(m.b, 0);
  });

  it("chains translate and rotate", () => {
    const m = parseTransformList("translate(10 20) rotate(45 5 5)");
    const p = applyMatrixToPoint(m, { x: 0, y: 0 });
    assert.ok(Math.abs(p.x - 10) > 0.01 || Math.abs(p.y - 20) > 0.01);
  });
});
