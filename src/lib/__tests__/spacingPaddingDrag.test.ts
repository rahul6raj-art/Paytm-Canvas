import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSpacingGapFromDrag,
  LAYOUT_GAP_MAX,
  LAYOUT_GAP_MIN,
  resolveGapAtHandleIndex,
  sanitizeLayoutGap,
} from "@/lib/autoLayout/spacingPaddingDrag";
import type { EditorNode } from "@/stores/useEditorStore";

describe("spacingPaddingDrag", () => {
  it("sanitizeLayoutGap rounds and clamps to layout gap bounds", () => {
    assert.equal(sanitizeLayoutGap(NaN), 0);
    assert.equal(sanitizeLayoutGap(undefined), 0);
    assert.equal(sanitizeLayoutGap(-4), -4);
    assert.equal(sanitizeLayoutGap(12.6), 13);
    assert.equal(sanitizeLayoutGap(LAYOUT_GAP_MIN - 1), LAYOUT_GAP_MIN);
    assert.equal(sanitizeLayoutGap(LAYOUT_GAP_MAX + 1), LAYOUT_GAP_MAX);
  });

  it("resolveGapAtHandleIndex uses configured gap when Auto is off and spacing matches", () => {
    const nodes: Record<string, EditorNode> = {
      f: {
        id: "f",
        parentId: null,
        type: "frame",
        name: "f",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutGapAuto: false,
      },
      a: {
        id: "a",
        parentId: "f",
        type: "rectangle",
        name: "a",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      b: {
        id: "b",
        parentId: "f",
        type: "rectangle",
        name: "b",
        x: 48,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
    };
    const childOrder = { f: ["a", "b"] };
    assert.equal(resolveGapAtHandleIndex("f", nodes, childOrder, "horizontal", 0), 8);
  });

  it("resolveGapAtHandleIndex measures visual gap when Auto is on", () => {
    const nodes: Record<string, EditorNode> = {
      f: {
        id: "f",
        parentId: null,
        type: "frame",
        name: "f",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutGapAuto: true,
      },
      a: {
        id: "a",
        parentId: "f",
        type: "rectangle",
        name: "a",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      b: {
        id: "b",
        parentId: "f",
        type: "rectangle",
        name: "b",
        x: 56,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
    };
    const childOrder = { f: ["a", "b"] };
    assert.equal(resolveGapAtHandleIndex("f", nodes, childOrder, "horizontal", 0), 16);
  });

  it("resolveGapAtHandleIndex uses measured gap when stored gap is stale low", () => {
    const nodes: Record<string, EditorNode> = {
      f: {
        id: "f",
        parentId: null,
        type: "frame",
        name: "f",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        layoutMode: "horizontal",
        layoutGap: 0,
        layoutGapAuto: false,
      },
      a: {
        id: "a",
        parentId: "f",
        type: "rectangle",
        name: "a",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      b: {
        id: "b",
        parentId: "f",
        type: "rectangle",
        name: "b",
        x: 56,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
    };
    const childOrder = { f: ["a", "b"] };
    assert.equal(resolveGapAtHandleIndex("f", nodes, childOrder, "horizontal", 0), 16);
  });

  it("resolveGapAtHandleIndex keeps configured gap when positions overlap", () => {
    const nodes: Record<string, EditorNode> = {
      f: {
        id: "f",
        parentId: null,
        type: "frame",
        name: "f",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        layoutMode: "horizontal",
        layoutGap: 24,
        layoutGapAuto: false,
      },
      a: {
        id: "a",
        parentId: "f",
        type: "rectangle",
        name: "a",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      b: {
        id: "b",
        parentId: "f",
        type: "rectangle",
        name: "b",
        x: 40,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
    };
    const childOrder = { f: ["a", "b"] };
    assert.equal(resolveGapAtHandleIndex("f", nodes, childOrder, "horizontal", 0), 24);
  });

  it("computeSpacingGapFromDrag uses screen pixels scaled by zoom", () => {
    assert.equal(
      computeSpacingGapFromDrag(10, 100, 200, 120, 200, "horizontal", 1, -256),
      30,
    );
    assert.equal(
      computeSpacingGapFromDrag(10, 100, 200, 120, 200, "horizontal", 2, -256),
      20,
    );
    assert.equal(
      computeSpacingGapFromDrag(8, 50, 100, 50, 140, "vertical", 1, -256),
      48,
    );
  });

  it("computeSpacingGapFromDrag stops at geometry min gap", () => {
    assert.equal(
      computeSpacingGapFromDrag(0, 100, 200, 0, 200, "horizontal", 1, -80),
      -80,
    );
  });
});
