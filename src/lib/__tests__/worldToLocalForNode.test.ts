import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import { worldToLocalForNode } from "@/lib/tree";

describe("worldToLocalForNode", () => {
  it("maps world point into node-local 0…size (not parent offset)", () => {
    const nodes: Record<string, EditorNode> = {
      frame: {
        id: "frame",
        type: "frame",
        name: "Frame",
        parentId: null,
        x: 100,
        y: 200,
        width: 400,
        height: 400,
        rotation: 0,
        visible: true,
        locked: false,
      } as EditorNode,
      ellipse: {
        id: "ellipse",
        type: "ellipse",
        name: "Ellipse",
        parentId: "frame",
        x: 50,
        y: 60,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
      } as EditorNode,
    };
    const childOrder = { frame: ["ellipse"] };
    const worldX = 100 + 50 + 75;
    const worldY = 200 + 60 + 25;
    const local = worldToLocalForNode(worldX, worldY, "ellipse", nodes, childOrder);
    assert.ok(Math.abs(local.x - 75) < 0.01);
    assert.ok(Math.abs(local.y - 25) < 0.01);
    const noOrder = worldToLocalForNode(worldX, worldY, "ellipse", nodes);
    assert.ok(Math.abs(noOrder.x - 75) < 0.01);
    assert.ok(Math.abs(noOrder.y - 25) < 0.01);
  });
});
