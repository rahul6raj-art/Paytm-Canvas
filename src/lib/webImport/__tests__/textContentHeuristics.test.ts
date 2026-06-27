import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isImportableTextContent,
  isTailwindUtilityText,
} from "../textContentHeuristics";

describe("textContentHeuristics", () => {
  it("rejects Tailwind utility strings", () => {
    assert.equal(isTailwindUtilityText("space-y-1"), true);
    assert.equal(isTailwindUtilityText("relative"), true);
    assert.equal(isTailwindUtilityText("flex"), true);
    assert.equal(isTailwindUtilityText("Email *"), false);
  });

  it("rejects className tokens appearing as text", () => {
    assert.equal(
      isImportableTextContent("space-y-1", { className: "space-y-1 relative", tagName: "div" }),
      false,
    );
    assert.equal(
      isImportableTextContent("Enter your email", { tagName: "label" }),
      true,
    );
    assert.equal(
      isImportableTextContent("Label", { className: "btn__label", tagName: "span" }),
      true,
    );
  });
});
