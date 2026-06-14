import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickInstalledFontFace,
  styleScoreForWeight,
  type InstalledFontFace,
} from "@/lib/fonts/localFontBinary";

function face(family: string, style: string): InstalledFontFace {
  return {
    family,
    fullName: `${family} ${style}`,
    postscriptName: family.replace(/\s+/g, ""),
    style,
    async blob() {
      return new Blob();
    },
  };
}

describe("localFontBinary", () => {
  it("prefers Regular for weight 400", () => {
    const faces = [face("Helvetica Neue", "Bold"), face("Helvetica Neue", "Regular")];
    const picked = pickInstalledFontFace(faces, "Helvetica Neue", 400);
    assert.equal(picked?.style, "Regular");
  });

  it("prefers Bold for weight 700", () => {
    const faces = [face("Helvetica Neue", "Regular"), face("Helvetica Neue", "Bold")];
    const picked = pickInstalledFontFace(faces, "Helvetica Neue", 700);
    assert.equal(picked?.style, "Bold");
  });

  it("scores semibold between regular and bold for weight 600", () => {
    assert.ok(styleScoreForWeight("Semibold", 600) > styleScoreForWeight("Regular", 600));
    assert.ok(styleScoreForWeight("Bold", 700) >= styleScoreForWeight("Semibold", 700));
  });
});
