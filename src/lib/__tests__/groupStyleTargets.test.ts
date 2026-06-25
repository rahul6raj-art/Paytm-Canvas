import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAlignTargetIds, canAlignSelection } from "@/lib/alignSelection";
import {
  collectContainerStyleTargets,
  containerSupportsAggregateFillStroke,
  expandStyleTargetIds,
} from "@/lib/groupStyleTargets";
import type { EditorNode } from "@/stores/useEditorStore";

function path(id: string, parentId: string | null): EditorNode {
  return {
    id,
    parentId,
    type: "path",
    name: "Vector",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#ffffff",
    fillEnabled: true,
  } as EditorNode;
}

describe("groupStyleTargets", () => {
  it("detects outlined text groups as aggregate fill/stroke containers", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Rahul",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        fillEnabled: false,
      } as EditorNode,
      r: path("r", "g"),
      a: path("a", "g"),
    };
    const childOrder = { g: ["r", "a"] };
    assert.equal(containerSupportsAggregateFillStroke(nodes.g!, nodes, childOrder), true);
    assert.deepEqual(
      collectContainerStyleTargets("g", nodes, childOrder).map((n) => n.id),
      ["r", "a"],
    );
    assert.deepEqual(expandStyleTargetIds("g", nodes, childOrder), ["r", "a"]);
  });
});

describe("resolveAlignTargetIds", () => {
  it("aligns children when a text outline group is selected", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Rahul",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
      } as EditorNode,
      r: path("r", "g"),
      a: path("a", "g"),
    };
    const childOrder = { g: ["r", "a"] };
    assert.deepEqual(resolveAlignTargetIds(["g"], nodes, childOrder), ["r", "a"]);
    assert.equal(canAlignSelection(["g"], nodes, childOrder), true);
  });
});
