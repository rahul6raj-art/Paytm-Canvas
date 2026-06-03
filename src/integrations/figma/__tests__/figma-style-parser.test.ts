import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { solidFromPaints } from "@/integrations/figma/figma-style-parser";

describe("solidFromPaints", () => {
  it("converts Figma RGB to hex fill", () => {
    const { fill } = solidFromPaints([
      {
        type: "SOLID",
        visible: true,
        color: { r: 1, g: 0, b: 0, a: 1 },
      },
    ]);
    assert.equal(fill, "#ff0000");
  });
});
