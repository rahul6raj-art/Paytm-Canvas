import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  colorTokenCategoryForName,
  groupColorDesignTokens,
} from "@/lib/colorTokenCategories";
import type { DesignToken } from "@/lib/designTokens";

function colorToken(name: string): DesignToken {
  return {
    id: `css-var-${name}`,
    name,
    type: "color",
    value: { hex: "#000000" },
    createdAt: "",
    updatedAt: "",
  };
}

describe("colorTokenCategories", () => {
  it("maps token names to semantic categories", () => {
    assert.equal(colorTokenCategoryForName("text-primary-strong"), "text");
    assert.equal(colorTokenCategoryForName("background-neutral-weak"), "background");
    assert.equal(colorTokenCategoryForName("border-default"), "border");
    assert.equal(colorTokenCategoryForName("icon-neutral-strong"), "icon");
    assert.equal(colorTokenCategoryForName("surface-level-4"), "surface");
    assert.equal(colorTokenCategoryForName("primitive-mono-100"), "primitive");
    assert.equal(colorTokenCategoryForName("Brand / Color"), "other");
  });

  it("groups tokens into ordered sections", () => {
    const groups = groupColorDesignTokens([
      colorToken("text-neutral-strong"),
      colorToken("background-neutral-weak"),
      colorToken("border-default"),
      colorToken("icon-neutral-strong"),
      colorToken("surface-level-4"),
    ]);

    assert.deepEqual(
      groups.map((g) => g.label),
      ["Background", "Surface", "Text", "Icon", "Border"],
    );
    assert.equal(groups.find((g) => g.id === "text")?.tokens.length, 1);
  });
});
