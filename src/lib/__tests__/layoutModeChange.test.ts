import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expandLayoutModePatch } from "@/lib/autoLayout/layoutModeChange";

describe("expandLayoutModePatch", () => {
  it("swaps sizing and alignment when rotating flow horizontal → vertical", () => {
    const expanded = expandLayoutModePatch(
      {
        layoutMode: "horizontal",
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "fixed",
        primaryAxisAlign: "center",
        counterAxisAlign: "stretch",
      },
      { layoutMode: "vertical" },
    );
    assert.equal(expanded.layoutMode, "vertical");
    assert.equal(expanded.layoutSizingHorizontal, "fixed");
    assert.equal(expanded.layoutSizingVertical, "hug");
    assert.equal(expanded.primaryAxisAlign, "start");
    assert.equal(expanded.counterAxisAlign, "center");
  });

  it("does not swap when enabling auto layout from none", () => {
    const expanded = expandLayoutModePatch({ layoutMode: "none" }, { layoutMode: "vertical" });
    assert.deepEqual(expanded, { layoutMode: "vertical" });
  });
});
