import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { repairNodeHierarchy } from "@/lib/editorGraph";
import type { FigNode } from "openfig-core";

// Test helpers mirror figToPaytmCraft mapping (imported via convert would need binary fig).
// We validate repair + root normalization behavior used after .fig import.

function frame(id: string, x: number, y: number, w: number, h: number) {
  return {
    id,
    parentId: null,
    type: "frame" as const,
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#fff",
    fillEnabled: true,
    clipChildren: true,
  };
}

describe("fig import layout expectations", () => {
  it("documents stack sizing fields on FigNode type", () => {
    const n = {
      stackMode: "VERTICAL",
      stackPrimarySizing: "RESIZE_TO_FIT",
      stackCounterSizing: "FIXED",
    } as FigNode;
    assert.equal(n.stackPrimarySizing, "RESIZE_TO_FIT");
    assert.equal(n.stackCounterSizing, "FIXED");
  });

  it("repair keeps root frame world size after childOrder sync", () => {
    const nodes = {
      f1: frame("f1", 5000, 5000, 390, 844),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: [] };
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.f1!.width, 390);
    assert.equal(fixed.nodes.f1!.height, 844);
  });
});
