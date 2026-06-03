import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoLayoutFromFigmaNode } from "@/integrations/figma/figma-layout-parser";
import type { FigmaApiNode } from "@/integrations/figma/types";

describe("autoLayoutFromFigmaNode", () => {
  it("maps vertical auto-layout to flex column", () => {
    const node: FigmaApiNode = {
      id: "1:1",
      type: "FRAME",
      layoutMode: "VERTICAL",
      itemSpacing: 12,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "STRETCH",
    };
    const fields = autoLayoutFromFigmaNode(node);
    assert.equal(fields.layoutMode, "vertical");
    assert.equal(fields.layoutGap, 12);
    assert.equal(fields.paddingTop, 8);
    assert.equal(fields.paddingLeft, 16);
    assert.equal(fields.counterAxisAlign, "stretch");
  });

  it("maps horizontal auto-layout to flex row", () => {
    const node: FigmaApiNode = {
      id: "1:2",
      type: "FRAME",
      layoutMode: "HORIZONTAL",
      itemSpacing: 4,
    };
    const fields = autoLayoutFromFigmaNode(node);
    assert.equal(fields.layoutMode, "horizontal");
    assert.equal(fields.layoutGap, 4);
  });
});
