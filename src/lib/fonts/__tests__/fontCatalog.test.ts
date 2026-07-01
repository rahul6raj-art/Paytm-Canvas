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

  it("resolves a CSS var to its fallback family when no DOM is available", () => {
    // Without a document (SSR / bridge import) the var resolves to its inline fallback so the
    // concrete family is still used instead of being dropped.
    assert.equal(
      canvasFontFamilyStack("var(--font-inter, Inter), system-ui"),
      "Inter, system-ui",
    );
  });

  it("quotes resolved family names that contain spaces and de-dupes", () => {
    assert.equal(
      canvasFontFamilyStack("var(--x, Helvetica Neue), Helvetica Neue, Arial"),
      '"Helvetica Neue", Arial',
    );
  });

  it("resolves a CSS var to the loaded (hashed) family from the document", () => {
    const prevDoc = (globalThis as { document?: unknown }).document;
    const prevGcs = (globalThis as { getComputedStyle?: unknown }).getComputedStyle;
    (globalThis as { document?: unknown }).document = { documentElement: {} };
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({
      getPropertyValue: (name: string) =>
        name === "--font-inter" ? '"__Inter_abc123", "__Inter_Fallback_abc123"' : "",
    });
    try {
      assert.equal(
        canvasFontFamilyStack("var(--font-inter), Inter, system-ui"),
        "__Inter_abc123, __Inter_Fallback_abc123, Inter, system-ui",
      );
    } finally {
      (globalThis as { document?: unknown }).document = prevDoc;
      (globalThis as { getComputedStyle?: unknown }).getComputedStyle = prevGcs;
    }
  });
});
