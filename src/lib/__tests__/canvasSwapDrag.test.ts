import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  canSwapNodes,
  findSwapTargetAtPoint,
  multiSelectSwapHandleIds,
  resolveSwapDropTarget,
  swapCandidatesForMultiSelect,
  swapPartnerForMultiSelect,
  swapNodeWorldPositions,
} from "@/lib/canvasSwapDrag";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, x: number, y: number, parentId: string | null = null): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ccc",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("canvasSwapDrag", () => {
  it("swapPartnerForMultiSelect returns the other top-level id", () => {
    const nodes = { a: rect("a", 0, 0), b: rect("b", 200, 0) };
    const partner = swapPartnerForMultiSelect("a", ["a", "b"], nodes);
    assert.equal(partner, "b");
  });

  it("canSwapNodes requires same parent and free layout", () => {
    const nodes = { a: rect("a", 0, 0), b: rect("b", 200, 0) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    assert.equal(canSwapNodes("a", "b", nodes, childOrder), true);
    nodes.b = { ...nodes.b!, parentId: "a" };
    assert.equal(canSwapNodes("a", "b", nodes, childOrder), false);
  });

  it("swapCandidatesForMultiSelect returns other tops for N-way selection", () => {
    const nodes = {
      a: rect("a", 0, 0),
      b: rect("b", 200, 0),
      c: rect("c", 400, 0),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b", "c"] };
    assert.deepEqual(
      swapCandidatesForMultiSelect("a", ["a", "b", "c"], nodes, childOrder).sort(),
      ["b", "c"],
    );
    assert.deepEqual(
      multiSelectSwapHandleIds(["a", "b", "c"], nodes, childOrder).sort(),
      ["a", "b", "c"],
    );
  });

  it("findSwapTargetAtPoint uses candidates when multi-selected", () => {
    const nodes = { a: rect("a", 0, 0), b: rect("b", 200, 0), c: rect("c", 400, 0) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b", "c"] };
    const hit = findSwapTargetAtPoint("a", 250, 40, nodes, childOrder, ["b", "c"]);
    assert.equal(hit, "b");
    const hitC = findSwapTargetAtPoint("a", 450, 40, nodes, childOrder, ["b", "c"]);
    assert.equal(hitC, "c");
  });

  it("resolveSwapDropTarget swaps on overlap when pointer misses", () => {
    const nodes = { a: rect("a", 0, 0), b: rect("b", 200, 0) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    nodes.a = { ...nodes.a!, x: 200, y: 0 };
    const hit = resolveSwapDropTarget("a", ["b"], "b", 5, 5, nodes, childOrder);
    assert.equal(hit, "b");
  });

  it("swapNodeWorldPositions exchanges origins", () => {
    const nodes = { a: rect("a", 10, 20), b: rect("b", 200, 50) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    const { nodes: next } = swapNodeWorldPositions(
      "a",
      "b",
      { x: 10, y: 20 },
      { x: 200, y: 50 },
      nodes,
      childOrder,
    );
    assert.equal(next.a!.x, 200);
    assert.equal(next.a!.y, 50);
    assert.equal(next.b!.x, 10);
    assert.equal(next.b!.y, 20);
  });
});
