import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clipContentContainerStyle,
  clipExportCssProperties,
  isLocalPointInsideClipBounds,
  isWorldPointVisibleThroughClipAncestors,
  shouldClipChildren,
} from "@/lib/clipChildren";
import { applyDeepAutoLayout, type LayoutNode } from "@/lib/autoLayout";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

function frame(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<LayoutNode> = {},
): LayoutNode {
  return {
    id,
    parentId: null,
    type: "frame",
    x,
    y,
    width,
    height,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("clipChildren", () => {
  it("matches Figma defaults: frames clip unless disabled, groups opt-in", () => {
    assert.equal(shouldClipChildren({ type: "frame" }), true);
    assert.equal(shouldClipChildren({ type: "frame", clipChildren: false }), false);
    assert.equal(shouldClipChildren({ type: "frame", clipChildren: true }), true);
    assert.equal(shouldClipChildren({ type: "group" }), false);
    assert.equal(shouldClipChildren({ type: "group", clipChildren: true }), true);
  });

  it("returns clip-path styles for canvas child containers", () => {
    const style = clipContentContainerStyle({ type: "frame", width: 100, height: 80 }, 8);
    assert.equal(style.overflow, "hidden");
    assert.match(String(style.clipPath), /inset\(0 round 8px\)/);
  });

  it("exports inset clip-path for code and inspect", () => {
    const css = clipExportCssProperties({ type: "frame", width: 120, height: 60, clipChildren: true },);
    assert.equal(css.overflow, "hidden");
    assert.equal(css.clipPath, "inset(0)");
  });

  it("rejects local points outside clipped bounds", () => {
    const parent = { type: "frame" as const, width: 100, height: 80, clipChildren: true as const };
    assert.equal(isLocalPointInsideClipBounds(50, 40, parent), true);
    assert.equal(isLocalPointInsideClipBounds(101, 40, parent), false);
  });

  it("hit test ignores children in visually clipped regions", () => {
    const nodes = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame" as const,
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        clipChildren: true,
        visible: true,
        locked: false,
        name: "P",
      },
      child: {
        id: "child",
        parentId: "parent",
        type: "rectangle" as const,
        x: 90,
        y: 10,
        width: 40,
        height: 40,
        visible: true,
        locked: false,
        name: "C",
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["parent"], parent: ["child"] };
    assert.equal(
      isWorldPointVisibleThroughClipAncestors(110, 30, "child", nodes, childOrder),
      false,
    );
    assert.equal(
      isWorldPointVisibleThroughClipAncestors(95, 30, "child", nodes, childOrder),
      true,
    );
  });

  it("hug auto-layout frame still grows with clip on (Figma: clip hides overflow only when fixed)", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
        clipChildren: true,
      },
      a: frame("a", 0, 0, 60, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 60, 40, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    const next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.ok((next.parent!.width ?? 0) > 100);
  });
});
