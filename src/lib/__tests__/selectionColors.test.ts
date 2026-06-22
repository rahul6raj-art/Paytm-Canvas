import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { collectSelectionFillColors, shouldShowSelectionColorsSection } from "@/lib/selectionColors";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, fill: string, fillOpacity = 1): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill,
    fillEnabled: true,
    fillOpacity,
    fillType: "solid",
    strokePosition: "center",
  } as EditorNode;
}

describe("collectSelectionFillColors", () => {
  it("groups unique solid fills across the selection", () => {
    const nodes = {
      a: rect("a", "#735858"),
      b: rect("b", "#964b4b"),
      c: rect("c", "#d9d9d9"),
      d: rect("d", "#e25d5d"),
    };
    const colors = collectSelectionFillColors(
      ["a", "b", "c", "d"],
      nodes,
    );
    assert.equal(colors.length, 4);
    assert.deepEqual(
      colors.map((c) => c.hex).sort(),
      ["#735858", "#964b4b", "#d9d9d9", "#e25d5d"].sort(),
    );
  });

  it("separates same hex with different opacity", () => {
    const nodes = {
      a: rect("a", "#ff0000", 1),
      b: rect("b", "#ff0000", 0.5),
    };
    const colors = collectSelectionFillColors(["a", "b"], nodes);
    assert.equal(colors.length, 2);
    assert.equal(colors.find((c) => c.opacity === 1)?.nodeIds.length, 1);
    assert.equal(colors.find((c) => c.opacity === 0.5)?.nodeIds.length, 1);
  });

  it("groups nodes that share the same color", () => {
    const nodes = {
      a: rect("a", "#3366ff"),
      b: rect("b", "#3366ff"),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    void childOrder;
    const colors = collectSelectionFillColors(["a", "b"], nodes);
    assert.equal(colors.length, 1);
    assert.deepEqual(colors[0]!.nodeIds.sort(), ["a", "b"]);
  });
});

describe("shouldShowSelectionColorsSection", () => {
  it("is false when all selected layers share one fill", () => {
    const nodes = {
      a: rect("a", "#3366ff"),
      b: rect("b", "#3366ff"),
    };
    assert.equal(shouldShowSelectionColorsSection(["a", "b"], nodes), false);
  });

  it("is true when the selection has multiple distinct fills", () => {
    const nodes = {
      a: rect("a", "#3366ff"),
      b: rect("b", "#ff0000"),
    };
    assert.equal(shouldShowSelectionColorsSection(["a", "b"], nodes), true);
  });

  it("is false for a single selected layer", () => {
    const nodes = { a: rect("a", "#3366ff") };
    assert.equal(shouldShowSelectionColorsSection(["a"], nodes), false);
  });
});
