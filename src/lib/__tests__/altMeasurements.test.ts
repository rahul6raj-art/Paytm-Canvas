import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeAltMeasureOverlay,
  insetMeasurements,
} from "@/lib/altMeasurements";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  type: EditorNode["type"] = "rectangle",
): EditorNode {
  return {
    id,
    parentId,
    type,
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ccc",
    fillEnabled: true,
  };
}

describe("altMeasurements", () => {
  it("insetMeasurements returns four sides", () => {
    const inner = { x: 213, y: 408, width: 773, height: 582 };
    const outer = { x: 0, y: 0, width: 1200, height: 1643 };
    const lines = insetMeasurements(inner, outer);
    assert.equal(lines.length, 4);
    assert.equal(lines.find((l) => l.key === "l")?.distance, 213);
    assert.equal(lines.find((l) => l.key === "t")?.distance, 408);
  });

  it("Option-hover on parent frame measures insets from selection", () => {
    const nodes: Record<string, EditorNode> = {
      frame: rect("frame", null, 0, 0, 1200, 1643, "frame"),
      child: rect("child", "frame", 213, 408, 773, 582),
    };
    const r = computeAltMeasureOverlay(["child"], "frame", nodes);
    assert.ok(r);
    assert.equal(r!.lines.find((l) => l.key === "l")?.distance, 213);
    assert.equal(r!.lines.find((l) => l.key === "t")?.distance, 408);
  });

  it("shows parent frame insets with no hover (Option held on selection only)", () => {
    const nodes: Record<string, EditorNode> = {
      frame: rect("frame", null, 0, 0, 1200, 1643, "frame"),
      child: rect("child", "frame", 213, 408, 773, 582),
    };
    const r = computeAltMeasureOverlay(["child"], null, nodes);
    assert.ok(r);
    assert.equal(r!.lines.find((l) => l.key === "r")?.distance, 214);
    assert.equal(r!.lines.find((l) => l.key === "b")?.distance, 653);
  });
});
