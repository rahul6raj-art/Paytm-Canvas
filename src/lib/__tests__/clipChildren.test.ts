import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildClipDebugInfo,
  buildClipStackForNode,
  clipContentContainerStyle,
  clipExportCssProperties,
  getUnclippedContentBoundsLocal,
  intersectClipBounds,
  isClipDebugEnabled,
  isLocalPointInsideClipBounds,
  isLocalPointInsideClipRegion,
  isWorldPointVisibleThroughClipAncestors,
  shouldClipChildren,
} from "@/lib/clipChildren";
import {
  applyDeepAutoLayout,
  applyLayoutPatchWithAutoLayout,
  type LayoutNode,
} from "@/lib/autoLayout";
import { autoLayoutPaddingGuideSize, flowContentExtentLocal } from "@/lib/autoLayout/autoLayoutGuideBounds";
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
    assert.equal(shouldClipChildren({ type: "group" }), false);
    assert.equal(shouldClipChildren({ type: "group", clipChildren: true }), true);
  });

  it("returns shape-aware clip-path styles for canvas child containers", () => {
    const style = clipContentContainerStyle({ type: "frame", width: 100, height: 80 }, 8);
    assert.equal(style.overflow, "hidden");
    assert.match(String(style.clipPath), /inset\(0 round 8px\)/);
  });

  it("exports inset clip-path for code and inspect", () => {
    const css = clipExportCssProperties({
      type: "frame",
      width: 120,
      height: 60,
      clipChildren: true,
    });
    assert.equal(css.overflow, "hidden");
    assert.equal(css.clipPath, "inset(0)");
  });

  it("child partially outside frame: layout unchanged, hit test rejects clipped pixels", () => {
    const nodes = {
      parent: frame("parent", 0, 0, 100, 80, { clipChildren: true, parentId: null }),
      child: {
        id: "child",
        parentId: "parent",
        type: "rectangle" as const,
        x: 80,
        y: 10,
        width: 40,
        height: 40,
        visible: true,
        locked: false,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["parent"], parent: ["child"] };
    assert.equal(nodes.child.x + nodes.child.width, 120);
    assert.equal(
      isWorldPointVisibleThroughClipAncestors(110, 30, "child", nodes, childOrder),
      false,
    );
    assert.equal(
      isWorldPointVisibleThroughClipAncestors(90, 30, "child", nodes, childOrder),
      true,
    );
  });

  it("absolute child outside frame keeps layout geometry independent of clip", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: frame("parent", 0, 0, 60, 60, {
        parentId: null,
        clipChildren: true,
        layoutMode: "horizontal",
        layoutGap: 0,
      }),
      child: frame("child", 200, 0, 40, 40, {
        parentId: "parent",
        layoutPositioning: "absolute",
      }),
    };
    const childOrder = { parent: ["child"] };
    const next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.equal(next.child!.x, 200);
    assert.equal(next.child!.width, 40);
  });

  it("rounded corner clipping rejects points outside corner arc", () => {
    const region = {
      nodeId: "f",
      bounds: { x: 0, y: 0, width: 100, height: 80 },
      cornerRadii: [20, 20, 20, 20] as [number, number, number, number],
    };
    assert.equal(isLocalPointInsideClipRegion(50, 40, region), true);
    assert.equal(isLocalPointInsideClipRegion(5, 5, region), false);
    assert.equal(isLocalPointInsideClipRegion(15, 15, region), true);
  });

  it("nested clip frames build ancestor clip stack", () => {
    const nodes = {
      outer: frame("outer", 0, 0, 200, 200, { parentId: null, clipChildren: true }),
      inner: frame("inner", 20, 20, 100, 100, { parentId: "outer", clipChildren: true }),
      leaf: frame("leaf", 0, 0, 40, 40, { parentId: "inner" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["outer"],
      outer: ["inner"],
      inner: ["leaf"],
    };
    const stack = buildClipStackForNode("leaf", nodes, childOrder);
    assert.equal(stack.length, 2);
    assert.equal(stack[0]!.nodeId, "outer");
    assert.equal(stack[1]!.nodeId, "inner");
  });

  it("intersectClipBounds combines regions in the same coordinate space", () => {
    const a = { x: 0, y: 0, width: 100, height: 80 };
    const b = { x: 20, y: 10, width: 60, height: 50 };
    const hit = intersectClipBounds(a, b);
    assert.deepEqual(hit, { x: 20, y: 10, width: 60, height: 50 });
  });

  it("auto layout inside clipped frame uses full child sizes", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: frame("parent", 0, 0, 100, 80, {
        parentId: null,
        clipChildren: true,
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      a: frame("a", 0, 0, 50, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 50, 40, { parentId: "parent" }),
      c: frame("c", 0, 0, 50, 40, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b", "c"] };
    const next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.equal(next.parent!.width, 100);
    assert.ok((next.c!.x ?? 0) + (next.c!.width ?? 0) > 100);
    const extent = flowContentExtentLocal("parent", next, childOrder);
    assert.ok(extent.width > 100);
    const guide = autoLayoutPaddingGuideSize("parent", next, childOrder);
    assert.equal(guide.width, extent.width);
  });

  it("hug parent with clip enabled still hugs to full content", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: frame("parent", 0, 0, 100, 80, {
        parentId: null,
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
        clipChildren: true,
      }),
      a: frame("a", 0, 0, 60, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 60, 40, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    const next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.ok((next.parent!.width ?? 0) > 100);
  });

  it("fill parent with clip enabled still assigns fill from layout", () => {
    const nodes: Record<string, LayoutNode> = {
      outer: frame("outer", 0, 0, 200, 100, {
        parentId: null,
        clipChildren: true,
        layoutMode: "vertical",
        layoutGap: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      fillRow: frame("fillRow", 0, 0, 10, 10, {
        parentId: "outer",
        layoutMode: "horizontal",
        layoutSizingHorizontal: "fill",
        layoutSizingVertical: "fixed",
        height: 50,
      }),
      inner: frame("inner", 0, 0, 80, 30, {
        parentId: "fillRow",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { outer: ["fillRow"], fillRow: ["inner"] };
    const next = applyDeepAutoLayout(nodes, childOrder, "outer");
    assert.equal(next.fillRow!.width, 200);
    assert.equal(next.inner!.width, 200);
  });

  it("clip does not block gap-responsive resize on fixed auto-layout frames", () => {
    const nodes: Record<string, LayoutNode> = {
      f: frame("f", 0, 0, 120, 80, {
        parentId: null,
        layoutMode: "horizontal",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        clipChildren: true,
        layoutGap: 8,
      }),
      a: frame("a", 0, 0, 50, 40, { parentId: "f" }),
      b: frame("b", 0, 0, 50, 40, { parentId: "f" }),
    };
    const childOrder = { f: ["a", "b"] };
    const gap32 = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 32,
      layoutGapAuto: false,
    });
    assert.ok((gap32.f!.width ?? 0) > 120);
  });

  it("debug info exposes frame bounds, clip stack, and unclipped content bounds", () => {
    const nodes = {
      parent: frame("parent", 0, 0, 100, 80, { parentId: null, clipChildren: true }),
      child: frame("child", 10, 10, 120, 40, { parentId: "parent" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["parent"], parent: ["child"] };
    const info = buildClipDebugInfo("parent", nodes, childOrder);
    assert.ok(info);
    assert.equal(info!.frameBounds.width, 100);
    assert.equal(info!.clipStack.length, 0);
    assert.equal(info!.unclippedContentBounds!.width, 120);
    assert.equal(isClipDebugEnabled(), false);
  });

  it("isLocalPointInsideClipBounds delegates to clip region", () => {
    const parent = { type: "frame" as const, width: 100, height: 80, clipChildren: true as const };
    assert.equal(isLocalPointInsideClipBounds(50, 40, parent), true);
    assert.equal(isLocalPointInsideClipBounds(101, 40, parent), false);
  });
});
