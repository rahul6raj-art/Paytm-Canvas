import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoLayoutPaddingGuideSize,
  autoLayoutPointInsideGuide,
  flowContentExtentLocal,
} from "@/lib/autoLayout/autoLayoutGuideBounds";
import type { EditorNode } from "@/stores/useEditorStore";

describe("autoLayoutGuideBounds", () => {
  it("uses frame size for padding guides when clip content is enabled", () => {
    const nodes: Record<string, EditorNode> = {
      f: {
        id: "f",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        clipChildren: true,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      },
      a: {
        id: "a",
        parentId: "f",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 40,
        visible: true,
        locked: false,
      },
      b: {
        id: "b",
        parentId: "f",
        type: "rectangle",
        x: 58,
        y: 0,
        width: 50,
        height: 40,
        visible: true,
        locked: false,
      },
      c: {
        id: "c",
        parentId: "f",
        type: "rectangle",
        x: 116,
        y: 0,
        width: 50,
        height: 40,
        visible: true,
        locked: false,
      },
    };
    const childOrder = { f: ["a", "b", "c"] };
    const extent = flowContentExtentLocal("f", nodes, childOrder);
    assert.ok(extent.width > 120);
    const guide = autoLayoutPaddingGuideSize("f", nodes, childOrder);
    assert.equal(guide.width, 120);
    assert.equal(guide.height, 80);
  });

  it("expands hug-axis guide size to content when not clipped", () => {
    const nodes: Record<string, EditorNode> = {
      f: {
        id: "f",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "fixed",
        clipChildren: false,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      },
      a: {
        id: "a",
        parentId: "f",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 40,
        visible: true,
        locked: false,
      },
      b: {
        id: "b",
        parentId: "f",
        type: "rectangle",
        x: 58,
        y: 0,
        width: 50,
        height: 40,
        visible: true,
        locked: false,
      },
    };
    const childOrder = { f: ["a", "b"] };
    const guide = autoLayoutPaddingGuideSize("f", nodes, childOrder);
    assert.equal(guide.width, 108);
    assert.equal(guide.height, 80);
  });

  it("detects points outside a clipped frame guide box", () => {
    const parent: EditorNode = {
      id: "f",
      parentId: null,
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      visible: true,
      locked: false,
      layoutMode: "horizontal",
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    };
    assert.equal(autoLayoutPointInsideGuide(50, 30, { width: 100, height: 60 }, parent), true);
    assert.equal(autoLayoutPointInsideGuide(110, 30, { width: 100, height: 60 }, parent), false);
  });
});
