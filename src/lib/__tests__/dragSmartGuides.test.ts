import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDragSmartGuides } from "@/lib/dragSmartGuides";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, x: number, y: number, w: number, h: number): EditorNode {
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
    fill: "#000",
    fillEnabled: true,
  };
}

describe("computeDragSmartGuides", () => {
  it("snaps left edge and shows gap measurement", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 100, 100),
      b: rect("b", 200, 50, 80, 80),
    };
    const proposed = { x: 102, y: 50, width: 80, height: 80 };
    const r = computeDragSmartGuides(["b"], proposed, nodes, 1);
    assert.equal(r.dx, -2);
    assert.ok(r.guides.some((g) => g.axis === "v" && Math.abs(g.pos - 100) < 1));

    const gapOnly = computeDragSmartGuides(
      ["b"],
      { x: 110, y: 50, width: 80, height: 80 },
      nodes,
      1,
    );
    assert.ok(gapOnly.measurements.some((m) => m.distance === 10));
  });
});
