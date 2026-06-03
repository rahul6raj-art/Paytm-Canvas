import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canvasFontFamilyStack, primaryFontName } from "@/lib/fonts/fontCatalog";

describe("font family resolution", () => {
  it("skips CSS variables in primaryFontName", () => {
    assert.equal(
      primaryFontName("var(--font-inter), Inter, system-ui, sans-serif"),
      "Inter",
    );
  });

  it("builds canvas-safe font stacks", () => {
    assert.equal(
      canvasFontFamilyStack("var(--font-inter), Inter, system-ui"),
      "Inter, system-ui",
    );
  });
});
