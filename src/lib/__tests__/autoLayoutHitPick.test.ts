import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { applyAutoLayoutToContainer } from "@/lib/autoLayoutSelection";
import { selectionTargetForClick } from "@/lib/containerSelection";
import { pickDeepestNodeAtWorldPoint } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 100,
    y: 100,
    width: 200,
    height: 120,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: "none",
    fillEnabled: true,
    fill: "#ffffff",
    ...extra,
  };
}

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: true,
    fill: "#cccccc",
    ...extra,
  };
}

describe("pickDeepestNodeAtWorldPoint — auto-layout frame", () => {
  it("picks a child shape inside an auto-layout frame", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f"], f: ["a", "b"] };

    const result = applyAutoLayoutToContainer(nodes, childOrder, "f");
    assert.ok(result);

    const laidOut = result!.nodes;
    const a = laidOut.a!;
    const worldX = 100 + a.x + a.width / 2;
    const worldY = 100 + a.y + a.height / 2;

    const hit = pickDeepestNodeAtWorldPoint(worldX, worldY, laidOut, result!.childOrder);
    assert.equal(hit, "a");
    assert.equal(selectionTargetForClick(hit!, laidOut, result!.childOrder, null), "f");
    assert.equal(selectionTargetForClick(hit!, laidOut, result!.childOrder, null, true), "a");
  });

  it("picks child when childOrder is stale but parentId is correct", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f", {
        layoutMode: "horizontal",
        layoutGap: 0,
        paddingTop: 10,
        paddingLeft: 10,
      }),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f", "a", "b"],
      f: [],
    };

    const a = nodes.a!;
    const worldX = 100 + a.x + a.width / 2;
    const worldY = 100 + a.y + a.height / 2;

    const hit = pickDeepestNodeAtWorldPoint(worldX, worldY, nodes, childOrder);
    assert.equal(hit, "a");
    assert.equal(selectionTargetForClick(hit!, nodes, childOrder, null), "f");
    assert.equal(selectionTargetForClick(hit!, nodes, childOrder, null, true), "a");
  });
});
