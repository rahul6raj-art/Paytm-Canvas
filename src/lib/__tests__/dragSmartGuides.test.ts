import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDragSmartGuides } from "@/lib/dragSmartGuides";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
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
    parentId: EDITOR_ROOT_KEY,
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
    ...extra,
  };
}

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return rect(id, x, y, w, h, { type: "frame", ...extra });
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

  it("measures gap between canvas root frames, not inner content", () => {
    const nodes: Record<string, EditorNode> = {
      frameA: frame("frameA", 0, 0, 400, 800),
      frameB: frame("frameB", 500, 0, 400, 800),
      innerBtn: rect("innerBtn", 20, 100, 80, 40, { parentId: "frameB" }),
    };
    const proposed = { x: 0, y: 0, width: 400, height: 800 };
    const r = computeDragSmartGuides(["frameA"], proposed, nodes, 1);

    assert.ok(r.measurements.some((m) => m.distance === 100));
    assert.ok(!r.measurements.some((m) => m.distance === 120));
  });

  it("shows only the nearest gap per direction", () => {
    const nodes: Record<string, EditorNode> = {
      near: rect("near", 120, 0, 40, 40),
      far: rect("far", 220, 0, 40, 40),
      moving: rect("moving", 0, 0, 40, 40),
    };
    const r = computeDragSmartGuides(
      ["moving"],
      { x: 0, y: 0, width: 40, height: 40 },
      nodes,
      1,
    );

    assert.equal(r.measurements.length, 1);
    assert.ok(r.measurements.some((m) => m.distance === 80));
    assert.ok(!r.measurements.some((m) => m.distance === 180));
  });
});
