import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  clonedNodePosition,
  layerPanelChildIds,
  parentUsesAutoLayout,
  getRenderedWorldTopLeft,
  insertNodeInChildOrder,
  needsChildOrderReconcile,
  needsNodeGeometryRepair,
  repairNodeHierarchy,
  reconcileChildOrderWithParents,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, x: number, y: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x,
    y,
    width: 400,
    height: 800,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

function rect(id: string, parentId: string | null, x: number, y: number): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: 100,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#000",
    fillEnabled: true,
    fillOpacity: 1,
    strokeColor: "#000",
    strokeWidth: 0,
    strokeStyle: "solid",
    strokePosition: "center",
    opacity: 1,
  };
}

describe("childOrderReconcile", () => {
  it("detects a child listed at root while parentId points at a frame", () => {
    const nodes = { f1: frame("f1", 87, 8), r1: rect("r1", "f1", 127, 673) };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "r1"],
      f1: [],
    };
    assert.equal(needsChildOrderReconcile(nodes, childOrder), true);
    const fixed = reconcileChildOrderWithParents(nodes, childOrder);
    assert.deepEqual(fixed[EDITOR_ROOT_KEY], ["f1"]);
    assert.deepEqual(fixed.f1, ["r1"]);
  });

  it("repairNodeHierarchy keeps parentId when child was wrongly listed at root", () => {
    const nodes = { f1: frame("f1", 87, 8), r1: rect("r1", "f1", 127, 673) };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "r1"],
      f1: [],
    };
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.r1!.parentId, "f1");
    assert.deepEqual(fixed.childOrder[EDITOR_ROOT_KEY], ["f1"]);
    assert.deepEqual(fixed.childOrder.f1, ["r1"]);
  });

  it("syncs parentId from childOrder when parentId was null but layer is under a frame", () => {
    const nodes = { f1: frame("f1", 0, 0), r1: rect("r1", null, 50, 80) };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1"],
      f1: ["r1"],
    };
    assert.equal(nodes.r1!.parentId, null);
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.r1!.parentId, "f1");
    assert.deepEqual(fixed.childOrder[EDITOR_ROOT_KEY], ["f1"]);
    assert.deepEqual(fixed.childOrder.f1, ["r1"]);
  });

  it("repair preserves rendered world position when parentId and childOrder disagree", () => {
    const nodes = { f1: frame("f1", 0, 100), r1: rect("r1", "f1", 50, 150) };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "r1"],
      f1: [],
    };
    assert.deepEqual(getRenderedWorldTopLeft("r1", nodes, childOrder), { x: 50, y: 150 });
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.r1!.parentId, "f1");
    assert.deepEqual(fixed.childOrder.f1, ["r1"]);
    assert.deepEqual(getRenderedWorldTopLeft("r1", fixed.nodes, fixed.childOrder), {
      x: 50,
      y: 150,
    });
    const wb = getRenderedWorldBounds("r1", fixed.nodes, fixed.childOrder);
    assert.equal(wb.x, 50);
    assert.equal(wb.y, 150);
    assert.equal(fixed.nodes.r1!.x, 50);
    assert.equal(fixed.nodes.r1!.y, 50);
  });

  it("repair aligns parent-local coords when frame parentId chain disagrees with childOrder", () => {
    const f1 = frame("f1", 0, 0);
    const nodes = {
      f1: { ...f1, parentId: "f2" },
      f2: frame("f2", 0, 400),
      r1: rect("r1", "f1", 246, 299),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f2"],
      f2: ["f1"],
      f1: ["r1"],
    };
    assert.deepEqual(getRenderedWorldTopLeft("r1", nodes, childOrder), { x: 246, y: 699 });
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.r1!.parentId, "f1");
    assert.deepEqual(getRenderedWorldTopLeft("r1", fixed.nodes, fixed.childOrder), {
      x: 246,
      y: 699,
    });
    assert.equal(fixed.nodes.r1!.x, 246);
    assert.equal(fixed.nodes.r1!.y, 299);
  });

  it("parentUsesAutoLayout detects horizontal and vertical frames", () => {
    const nodes = {
      al: { ...frame("al", 0, 0), layoutMode: "horizontal" as const },
      manual: frame("manual", 0, 0),
    };
    assert.equal(parentUsesAutoLayout("al", nodes), true);
    assert.equal(parentUsesAutoLayout("manual", nodes), false);
    assert.equal(parentUsesAutoLayout(null, nodes), false);
  });

  it("clonedNodePosition keeps the same position when offset is 0", () => {
    const nodes = {
      f1: frame("f1", 120, 200),
      r1: rect("r1", "f1", 10, 20),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1"],
      f1: ["r1"],
    };
    const rootPos = clonedNodePosition("f1", true, null, nodes, childOrder, null, nodes.f1!);
    assert.deepEqual(rootPos, { x: 120, y: 200 });
    const childPos = clonedNodePosition("r1", false, null, nodes, childOrder, "f1", nodes.r1!);
    assert.deepEqual(childPos, { x: 10, y: 20 });
  });

  it("clonedNodePosition offsets only the tree root upward in world space", () => {
    const nodes = {
      f1: frame("f1", 80, 80),
      r1: rect("r1", "f1", 0, 0),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1"],
      f1: ["r1"],
    };
    const rootPos = clonedNodePosition("f1", true, { dx: 0, dy: -24 }, nodes, childOrder, null, nodes.f1!);
    assert.deepEqual(rootPos, { x: 80, y: 56 });
    const childPos = clonedNodePosition("r1", false, { dx: 0, dy: -24 }, nodes, childOrder, "f1", nodes.r1!);
    assert.deepEqual(childPos, { x: 0, y: 0 });
    assert.deepEqual(getRenderedWorldTopLeft("r1", nodes, childOrder), { x: 80, y: 80 });
  });

  it("repair keeps child world position when nested frame had world-like local coords", () => {
    const nodes = {
      f1: frame("f1", 0, 0),
      f2: { ...frame("f2", 0, 812), parentId: null },
      r1: rect("r1", "f2", 0, 0),
    };
    nodes.r1 = { ...nodes.r1, fill: "#ff0000" };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "f2"],
      f2: ["r1"],
    };
    const before = getRenderedWorldTopLeft("r1", nodes, childOrder);
    const fixed = repairNodeHierarchy(nodes, childOrder);
    const after = getRenderedWorldTopLeft("r1", fixed.nodes, fixed.childOrder);
    assert.deepEqual(after, before);
    assert.equal(fixed.nodes.r1!.parentId, "f2");
    assert.equal(fixed.nodes.r1!.x, 0);
    assert.equal(fixed.nodes.r1!.y, 0);
    assert.equal(fixed.nodes.f2!.x, 0);
    assert.equal(fixed.nodes.f2!.y, 812);
  });

  it("insertNodeInChildOrder removes duplicate root entries", () => {
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "r1"],
      f1: [],
    };
    const next = insertNodeInChildOrder(childOrder, "r1", "f1");
    assert.deepEqual(next[EDITOR_ROOT_KEY], ["f1"]);
    assert.deepEqual(next.f1, ["r1"]);
  });

  it("layerPanelChildIds hides children wrongly listed at root", () => {
    const nodes = { f1: frame("f1", 87, 8), r1: rect("r1", "f1", 127, 673) };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "r1"],
      f1: [],
    };
    assert.deepEqual(layerPanelChildIds(EDITOR_ROOT_KEY, nodes, childOrder), ["f1"]);
    assert.deepEqual(layerPanelChildIds("f1", nodes, childOrder), ["r1"]);
  });

  it("layerPanelChildIds dedupes duplicate childOrder entries", () => {
    const nodes = { f1: frame("f1", 0, 0) };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "f1"],
      f1: [],
    };
    assert.deepEqual(layerPanelChildIds(EDITOR_ROOT_KEY, nodes, childOrder), ["f1"]);
  });

  it("needsNodeGeometryRepair ignores rotated local transform boxes", () => {
    const r1 = { ...rect("r1", null, 100, 80), width: 200, height: 120, rotation: 24 };
    const nodes = { r1 };
    const childOrder = { [EDITOR_ROOT_KEY]: ["r1"] };
    assert.equal(needsNodeGeometryRepair(nodes, childOrder), false);
  });

  it("repairNodeHierarchy preserves rotated node local geometry", () => {
    const r1 = { ...rect("r1", null, 100, 80), width: 200, height: 120, rotation: 24 };
    const nodes = { r1 };
    const childOrder = { [EDITOR_ROOT_KEY]: ["r1"] };
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.r1!.x, 100);
    assert.equal(fixed.nodes.r1!.y, 80);
    assert.equal(fixed.nodes.r1!.width, 200);
    assert.equal(fixed.nodes.r1!.height, 120);
    assert.equal(fixed.nodes.r1!.rotation, 24);
  });
});
