import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { embeddedFontFileForTextNode } from "@/lib/text/textOutlineFonts";
import type { EditorNode } from "@/stores/useEditorStore";

function textNode(extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "t1",
    parentId: null,
    type: "text",
    name: "Text",
    x: 0,
    y: 0,
    width: 120,
    height: 32,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Abc",
    fill: "#ffffff",
    fillEnabled: true,
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 500,
    ...extra,
  } as EditorNode;
}

describe("textOutlineFonts", () => {
  it("maps Inter to embedded regular/bold files", () => {
    assert.equal(
      embeddedFontFileForTextNode(textNode({ fontWeight: 400 })),
      "Inter-Regular.ttf",
    );
    assert.equal(embeddedFontFileForTextNode(textNode()), "Inter-Regular.ttf");
    assert.equal(
      embeddedFontFileForTextNode(textNode({ fontWeight: 700 })),
      "Inter-Bold.ttf",
    );
  });

  it("maps Roboto and script families", () => {
    assert.equal(
      embeddedFontFileForTextNode(textNode({ fontFamily: "Roboto", fontWeight: 400 })),
      "Roboto-Regular.ttf",
    );
    assert.equal(
      embeddedFontFileForTextNode(textNode({ fontFamily: "Noto Sans Arabic" })),
      "NotoSansArabic-Regular.ttf",
    );
  });
});
