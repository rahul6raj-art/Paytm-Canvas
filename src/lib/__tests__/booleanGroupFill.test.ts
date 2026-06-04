import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expandBooleanFillStylePatches } from "@/lib/booleanGroupFill";
import type { EditorNode } from "@/stores/useEditorStore";

function path(id: string, parentId: string, fill: string): EditorNode {
  return {
    id,
    parentId,
    type: "path",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    pathPoints: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 100, y: 100 },
    ],
    pathClosed: true,
    fill,
    fillEnabled: true,
  };
}

describe("expandBooleanFillStylePatches", () => {
  it("propagates group fill to operands", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Exclude",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "exclude",
        fill: "#cfcfcf",
        fillEnabled: true,
      },
      a: path("a", "g", "#cfcfcf"),
      b: path("b", "g", "#cfcfcf"),
    };
    const childOrder = { g: ["a", "b"] };
    const expanded = expandBooleanFillStylePatches(
      "g",
      { fill: "#ff5500" },
      nodes,
      childOrder,
    );
    assert.ok(expanded);
    assert.equal(expanded!.g.fill, "#ff5500");
    assert.equal(expanded!.a.fill, "#ff5500");
    assert.equal(expanded!.b.fill, "#ff5500");
  });

  it("syncs operand fill change to boolean group", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Exclude",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "exclude",
        fill: "#cfcfcf",
        fillEnabled: true,
      },
      a: path("a", "g", "#cfcfcf"),
      b: path("b", "g", "#cfcfcf"),
    };
    const childOrder = { g: ["a", "b"] };
    const expanded = expandBooleanFillStylePatches(
      "a",
      { fill: "#112233" },
      nodes,
      childOrder,
    );
    assert.ok(expanded);
    assert.equal(expanded!.g.fill, "#112233");
    assert.equal(expanded!.a.fill, "#112233");
    assert.equal(expanded!.b.fill, "#112233");
  });
});
