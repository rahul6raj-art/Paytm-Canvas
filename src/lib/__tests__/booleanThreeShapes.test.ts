import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBooleanOperation,
  buildBooleanRenderForGroup,
  flattenBooleanGroup,
  shapesToBooleanInput,
} from "@/lib/booleanGeometry";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(
  id: string,
  parentId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#3366ff",
    fillEnabled: true,
    strokePosition: "center",
  } as EditorNode;
}

function threeRectScene(op: "union" | "subtract" | "intersect" | "exclude") {
  const g = "g";
  const a = rect("a", g, 0, 0, 100, 100);
  const b = rect("b", g, 50, 0, 100, 100);
  const c = rect("c", g, 25, 50, 100, 100);
  const group = {
    id: g,
    parentId: null,
    type: "group",
    name: op,
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    rotation: 0,
    visible: true,
    locked: false,
    isBooleanGroup: true,
    booleanOperation: op,
  } as EditorNode;
  const nodes = { [g]: group, a, b, c };
  const childOrder = { [g]: ["a", "b", "c"] };
  return { g, nodes, childOrder, childIds: ["a", "b", "c"] as string[] };
}

describe("boolean with three shapes", () => {
  it("clipper union/subtract/intersect/exclude all produce results", () => {
    const { childIds, nodes, childOrder } = threeRectScene("union");
    const inputs = shapesToBooleanInput(childIds, nodes, childOrder);
    assert.equal(inputs.length, 3);
    for (const op of ["union", "subtract", "intersect", "exclude"] as const) {
      const result = applyBooleanOperation(op, inputs);
      assert.ok(result, `clipper failed for ${op}`);
      assert.ok(result!.pathD.length > 10);
    }
  });

  it("preview render models exist for three-operand groups", () => {
    for (const op of ["union", "subtract", "intersect", "exclude"] as const) {
      const { g, nodes, childOrder, childIds } = threeRectScene(op);
      const render = buildBooleanRenderForGroup(g, childIds, nodes, op, childOrder);
      assert.ok(render, `missing render for ${op}`);
      assert.equal(render!.op, "clipper");
      assert.ok(render.pathD.length > 10);
    }
  });

  it("createBooleanGroup with three root rectangles uses clipper preview", () => {
    const a = `ra-${Date.now()}`;
    const b = `rb-${Date.now()}`;
    const c = `rc-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [a]: { ...rect(a, null, 0, 0, 100, 100) },
        [b]: { ...rect(b, null, 50, 0, 100, 100) },
        [c]: { ...rect(c, null, 25, 50, 100, 100) },
      },
      childOrder: { [EDITOR_ROOT_KEY]: [a, b, c] },
      selectedIds: [a, b, c],
      editorMode: "design",
    });
    useEditorStore.getState().createBooleanGroup("exclude");
    const st = useEditorStore.getState();
    const gid = st.selectedIds[0]!;
    const kids = st.childOrder[gid] ?? [];
    assert.equal(kids.length, 3);

    const render = buildBooleanRenderForGroup(
      gid,
      kids,
      st.nodes,
      "exclude",
      st.childOrder,
    );
    const inputs = shapesToBooleanInput(kids, st.nodes, st.childOrder);
    const clip = applyBooleanOperation("exclude", inputs);
    assert.ok(render && clip);
    assert.equal(render!.op, "clipper");
    assert.equal(render!.pathD, clip!.pathD);
  });
});
