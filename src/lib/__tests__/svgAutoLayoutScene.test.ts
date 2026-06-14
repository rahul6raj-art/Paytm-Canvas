import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  applyAutoLayoutToContainer,
  applyAutoLayoutToSelection,
} from "@/lib/autoLayoutSelection";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: extra.name ?? `Frame ${id}`,
    x: 0,
    y: 0,
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
    name: extra.name ?? `Rectangle ${id}`,
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

describe("buildSvgScene — auto-layout children", () => {
  it("renders children inside an auto-layout frame", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f" }),
    };
    const childOrder = { f: ["a", "b"] };

    const result = applyAutoLayoutToContainer(nodes, childOrder, "f");
    assert.ok(result);

    const scene = buildSvgScene({
      rootIds: ["f"],
      nodes: result!.nodes,
      childOrder: result!.childOrder,
    });
    assert.ok(scene.renderedNodeCount >= 3, `expected frame + 2 rects, got ${scene.renderedNodeCount}`);
    assert.ok(scene.body.includes("<rect"), "expected rectangle markup in scene body");
  });

  it("renders children when childOrder still lists them at page root (parentId is correct)", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f", { layoutMode: "horizontal", layoutGap: 0, paddingTop: 10, paddingLeft: 10 }),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f", "a", "b"],
      f: [],
    };

    const scene = buildSvgScene({
      rootIds: ["f"],
      nodes,
      childOrder,
    });
    assert.ok(
      scene.renderedNodeCount >= 3,
      `children must render inside frame even with stale childOrder, got ${scene.renderedNodeCount}`,
    );
  });

  it("renders wrapped auto-layout frame with children", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 20),
      b: rect("b", 50, 0, 40, 20),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };

    const result = applyAutoLayoutToSelection(nodes, childOrder, ["a", "b"]);
    assert.ok(result);

    const frameId = result!.selectedIds[0]!;
    const scene = buildSvgScene({
      rootIds: result!.childOrder[EDITOR_ROOT_KEY] ?? [frameId],
      nodes: result!.nodes,
      childOrder: result!.childOrder,
    });
    assert.ok(scene.renderedNodeCount >= 3);
    assert.ok(result!.childOrder[frameId]?.length === 2);
  });
});
