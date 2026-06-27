import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseLineHeightInput,
} from "@/components/editor/design-panel/LineHeightInput";
import {
  AUTO_LINE_HEIGHT_MULTIPLIER,
  effectiveLineHeightMultiplier,
  isAutoLineHeight,
  lineHeightAutoPatch,
  lineHeightPercentPatch,
  lineHeightUnitFromNode,
  resolveLineHeightPx,
  resolveLineHeightPxFromNode,
} from "@/lib/text/lineHeight";
import { resolveTextTypo } from "@/lib/textTypography";

describe("lineHeight", () => {
  it("defaults to auto when line height is unset", () => {
    assert.equal(isAutoLineHeight({}), true);
    assert.equal(lineHeightUnitFromNode({}), "auto");
    assert.equal(resolveLineHeightPx(16, undefined, "auto"), Math.round(16 * AUTO_LINE_HEIGHT_MULTIPLIER));
  });

  it("treats explicit multiplier as percent", () => {
    assert.equal(isAutoLineHeight({ lineHeight: 1.25 }), false);
    assert.equal(lineHeightUnitFromNode({ lineHeight: 1.25 }), "percent");
    assert.equal(resolveLineHeightPx(16, 1.25, "percent"), 20);
    assert.equal(resolveLineHeightPx(20, 150, "percent"), 30);
  });

  it("matches canvas typography resolution", () => {
    const autoTypo = resolveTextTypo({ fontSize: 14 });
    assert.equal(autoTypo.lineHeightUnit, "auto");
    assert.equal(autoTypo.lineHeightPx, 17);
    assert.equal(autoTypo.lineHeight, 17 / 14);

    const fixedTypo = resolveTextTypo({ fontSize: 14, lineHeight: 150, lineHeightUnit: "percent" });
    assert.equal(fixedTypo.lineHeight, 1.5);
    assert.equal(fixedTypo.lineHeightUnit, "percent");
    assert.equal(fixedTypo.lineHeightPx, 21);
  });

  it("builds style patches for inspector commits", () => {
    assert.deepEqual(lineHeightPercentPatch(1.35), {
      lineHeight: 1.35,
      lineHeightUnit: "percent",
    });
    assert.deepEqual(lineHeightAutoPatch(), {
      lineHeight: undefined,
      lineHeightUnit: "auto",
    });
  });

  it("resolves px values from node fields", () => {
    assert.equal(
      resolveLineHeightPxFromNode({ fontSize: 14, lineHeight: 20, lineHeightUnit: "px" }),
      20,
    );
    assert.equal(
      effectiveLineHeightMultiplier({ fontSize: 14, lineHeightUnit: "auto" }),
      17 / 14,
    );
  });

  it("parses inspector input: Auto, px, and percent", () => {
    assert.deepEqual(parseLineHeightInput("Auto"), {
      lineHeight: undefined,
      lineHeightUnit: "auto",
    });
    assert.deepEqual(parseLineHeightInput("23"), {
      lineHeight: 23,
      lineHeightUnit: "px",
    });
    assert.deepEqual(parseLineHeightInput("150%"), {
      lineHeight: 150,
      lineHeightUnit: "percent",
    });
  });
});
