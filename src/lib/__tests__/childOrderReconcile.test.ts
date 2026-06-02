import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  insertNodeInChildOrder,
  needsChildOrderReconcile,
  repairNodeHierarchy,
  reconcileChildOrderWithParents,
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

  it("insertNodeInChildOrder removes duplicate root entries", () => {
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f1", "r1"],
      f1: [],
    };
    const next = insertNodeInChildOrder(childOrder, "r1", "f1");
    assert.deepEqual(next[EDITOR_ROOT_KEY], ["f1"]);
    assert.deepEqual(next.f1, ["r1"]);
  });
});
