import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStrokeDashArray,
  strokeMiterAngleToLimit,
  defaultDashGapForStyle,
} from "../stroke";

describe("stroke", () => {
  it("builds custom dash array from dash and gap", () => {
    assert.equal(
      resolveStrokeDashArray({
        strokeStyle: "dashed",
        strokeWidth: 2,
        strokeDashLength: 2,
        strokeDashGap: 2,
      }),
      "2 2",
    );
  });

  it("uses defaults for dashed when dash/gap unset", () => {
    const d = defaultDashGapForStyle("dashed", 2);
    assert.equal(
      resolveStrokeDashArray({ strokeStyle: "dashed", strokeWidth: 2 }),
      `${d.dash} ${d.gap}`,
    );
  });

  it("converts miter angle to SVG limit near 4 for ~29°", () => {
    const limit = strokeMiterAngleToLimit(28.967);
    assert.ok(limit > 3.5 && limit < 5);
  });
});
