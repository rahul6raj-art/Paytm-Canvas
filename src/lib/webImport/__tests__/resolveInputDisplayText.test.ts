import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInputDisplayText } from "@/lib/webImport/canvasNodeBuilder";
import type { DesignNode } from "@/lib/webImport/types";

function inputNode(partial: Partial<DesignNode>): DesignNode {
  return {
    id: "n1",
    domId: "n1",
    tagName: "input",
    name: "Input",
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    layout: { kind: "absolute", layoutPositioning: "absolute" },
    style: {},
    children: [],
    ...partial,
  };
}

describe("resolveInputDisplayText", () => {
  it("prefers inputValue over whitespace-only floating-label placeholder", () => {
    const text = resolveInputDisplayText(
      inputNode({
        placeholder: " ",
        inputValue: "+91 34567 89876",
      }),
    );
    assert.equal(text, "+91 34567 89876");
  });

  it("falls back to placeholder when value is empty", () => {
    const text = resolveInputDisplayText(
      inputNode({
        placeholder: "Email address",
        inputValue: "",
      }),
    );
    assert.equal(text, "Email address");
  });
});
