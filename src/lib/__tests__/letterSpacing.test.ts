import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  letterSpacingPercentFromNode,
  letterSpacingPercentPatch,
  letterSpacingUnitFromNode,
  resolveLetterSpacingPx,
  resolveLetterSpacingPxFromNode,
} from "@/lib/text/letterSpacing";
import { resolveTextTypo } from "@/lib/textTypography";

describe("letterSpacing", () => {
  it("defaults legacy nodes to px storage", () => {
    assert.equal(letterSpacingUnitFromNode({ letterSpacing: 2 }), "px");
    assert.equal(resolveLetterSpacingPx(14, 2, "px"), 2);
    assert.equal(letterSpacingPercentFromNode({ fontSize: 14, letterSpacing: 2 }), (2 / 14) * 100);
  });

  it("stores and resolves percent values", () => {
    assert.equal(resolveLetterSpacingPx(20, 5, "percent"), 1);
    assert.equal(
      resolveLetterSpacingPxFromNode({
        fontSize: 20,
        letterSpacing: 5,
        letterSpacingUnit: "percent",
      }),
      1,
    );
  });

  it("matches canvas typography resolution", () => {
    const typo = resolveTextTypo({
      fontSize: 16,
      letterSpacing: 10,
      letterSpacingUnit: "percent",
    });
    assert.equal(typo.letterSpacing, 1.6);
  });

  it("builds inspector patch commits", () => {
    assert.deepEqual(letterSpacingPercentPatch(-2.5), {
      letterSpacing: -2.5,
      letterSpacingUnit: "percent",
    });
  });
});
