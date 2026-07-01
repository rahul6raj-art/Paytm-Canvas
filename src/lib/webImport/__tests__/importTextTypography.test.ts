import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { fixImportedTextLineHeightUnit } from "@/lib/webImport/importTextTypography";
import { resolveLineHeightPxFromNode } from "@/lib/text/lineHeight";

describe("importTextTypography", () => {
  it("treats unitless CSS line-height ratios as percent storage", () => {
    const fixed = fixImportedTextLineHeightUnit({
      type: "text",
      fontSize: 36,
      lineHeight: 40 / 36,
    } as EditorNode);
    assert.equal(fixed.lineHeightUnit, "percent");
    assert.equal(fixed.lineHeight, 111);
    assert.ok(Math.abs(resolveLineHeightPxFromNode(fixed) - 40) < 1);
  });

  it("treats raw px line-height values as px unit", () => {
    const fixed = fixImportedTextLineHeightUnit({
      type: "text",
      fontSize: 36,
      lineHeight: 40,
    } as EditorNode);
    assert.equal(fixed.lineHeightUnit, "px");
    assert.equal(fixed.lineHeight, 40);
    assert.equal(resolveLineHeightPxFromNode(fixed), 40);
  });
});
