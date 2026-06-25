import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import { outlineFaceWeight, opentypeSampleEmHeight, resolveOutlineFontSize } from "@/lib/text/textOutlineMetrics";

const interRegular = path.join(
  process.cwd(),
  "packages/craft-engine/assets/Inter-Regular.ttf",
);

describe("textOutlineMetrics", () => {
  it("maps face weight tiers for outline fonts", () => {
    assert.equal(outlineFaceWeight(400), 400);
    assert.equal(outlineFaceWeight(500), 400);
    assert.equal(outlineFaceWeight(600), 700);
    assert.equal(outlineFaceWeight(700), 700);
  });

  it("boosts outline font size for medium weight vs regular face", () => {
    const buffer = fs.readFileSync(interRegular);
    const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const base = resolveOutlineFontSize(
      {
        color: "#fff",
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      font,
      400,
    );
    const medium = resolveOutlineFontSize(
      {
        color: "#fff",
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      font,
      400,
    );
    assert.ok(medium > base, "medium weight should outline larger than regular face at 400");
  });

  it("samples Inter em height without multi-char GSUB errors", () => {
    const buffer = fs.readFileSync(interRegular);
    const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    assert.throws(() => font.getPath("Hg", 0, 0, 16).getBoundingBox());
    const height = opentypeSampleEmHeight(font, 16);
    assert.ok(height > 10 && height < 24);
  });
});
