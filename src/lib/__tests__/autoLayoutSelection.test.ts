import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { applyAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import type { EditorNode } from "@/stores/useEditorStore";

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

describe("applyAutoLayoutToSelection — frame naming", () => {
  it("names wrapped multi-select frames Frame 1, Frame 2, …", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 20),
      b: rect("b", 50, 0, 40, 20),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };

    const first = applyAutoLayoutToSelection(nodes, childOrder, ["a", "b"]);
    assert.ok(first);
    const frame1 = first!.nodes[first!.selectedIds[0]!]!;
    assert.equal(frame1.name, "Frame 1");

    const nodes2 = {
      ...first!.nodes,
      c: rect("c", 200, 0, 30, 30, { name: "Ellipse 1" }),
    };
    const childOrder2 = {
      ...first!.childOrder,
      [EDITOR_ROOT_KEY]: [...(first!.childOrder[EDITOR_ROOT_KEY] ?? []), "c"],
    };

    const second = applyAutoLayoutToSelection(nodes2, childOrder2, ["c"]);
    assert.ok(second);
    const frame2 = second!.nodes[second!.selectedIds[0]!]!;
    assert.equal(frame2.name, "Frame 2");
    assert.notEqual(frame2.name, "Auto layout");
  });
});
