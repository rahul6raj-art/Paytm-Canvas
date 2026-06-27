import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { releaseAutoLayoutContainerToManual } from "@/lib/autoLayout/releaseAutoLayoutToManual";
import {
  ensureManualScreenLayout,
  isManualScreenFrame,
  rootFrameIds,
} from "@/lib/webImport/manualScreenFrames";
import { applyAutoLayoutToContainer } from "@/lib/autoLayoutSelection";

function frame(
  id: string,
  parentId: string | null,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 390,
    height: 844,
    rotation: 0,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("manual screen editing", () => {
  it("treats PML screen names as manual artboards", () => {
    const nodes = {
      screen: frame("screen", null, { name: "PML- More" }),
    };
    const rootIds = rootFrameIds({ [EDITOR_ROOT_KEY]: ["screen"] });
    assert.equal(isManualScreenFrame(nodes.screen, rootIds), true);
  });

  it("does not treat generic top-level frames as imported screens", () => {
    const nodes = {
      card: frame("card", null, { name: "Card" }),
    };
    const rootIds = rootFrameIds({ [EDITOR_ROOT_KEY]: ["card"] });
    assert.equal(isManualScreenFrame(nodes.card, rootIds), false);
  });

  it("allows auto layout on generic top-level frames", () => {
    const nodes: Record<string, EditorNode> = {
      card: frame("card", null, { name: "Card" }),
      a: frame("a", "card", { x: 16, y: 20, width: 100, height: 40 }),
      b: frame("b", "card", { x: 16, y: 80, width: 100, height: 40 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["card"],
      card: ["a", "b"],
    };
    const result = applyAutoLayoutToContainer(nodes, childOrder, "card");
    assert.ok(result);
    assert.notEqual(result!.nodes.card?.layoutMode, "none");
  });

  it("blocks auto layout on screen artboards", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, { name: "PML- More", manualScreenLayout: true }),
      a: frame("a", "screen", { x: 16, y: 20, width: 100, height: 40 }),
      b: frame("b", "screen", { x: 16, y: 80, width: 100, height: 40 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["a", "b"],
    };
    const result = applyAutoLayoutToContainer(nodes, childOrder, "screen");
    assert.equal(result, null);
  });

  it("releases auto layout to manual without moving children", () => {
    const nodes: Record<string, EditorNode> = {
      stack: frame("stack", null, {
        layoutMode: "vertical",
        layoutGap: 12,
        paddingTop: 8,
        paddingLeft: 8,
      }),
      a: frame("a", "stack", { x: 8, y: 8, width: 100, height: 40, layoutPositioning: "auto" }),
      b: frame("b", "stack", { x: 8, y: 60, width: 100, height: 40, layoutPositioning: "auto" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["stack"],
      stack: ["a", "b"],
    };
    const next = releaseAutoLayoutContainerToManual(nodes, childOrder, "stack");
    assert.equal(next.stack?.layoutMode, "none");
    assert.equal(next.a?.x, 8);
    assert.equal(next.a?.y, 8);
    assert.equal(next.a?.layoutPositioning, "absolute");
  });

  it("ensureManualScreenLayout clears accidental auto on imported screens", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, {
        name: "PML- More",
        manualScreenLayout: true,
        layoutMode: "vertical",
        layoutGap: 0,
      }),
      child: frame("child", "screen", { x: 0, y: 100, width: 390, height: 700 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["child"],
    };
    const next = ensureManualScreenLayout(nodes, childOrder, "screen");
    assert.equal(next.screen?.layoutMode, "none");
    assert.equal(next.child?.y, 100);
  });
});
