import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { synthesizeWebImportAutoLayout } from "../synthesizeWebImportAutoLayout";
import { finalizeWebImportGraph } from "../finalizeWebImportGraph";

function frame(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("synthesizeWebImportAutoLayout", () => {
  it("forces phone shell and artboard to manual layout", () => {
    const nodes: Record<string, EditorNode> = {
      artboard: frame("artboard", null, 80, 80, 390, 844, { layoutMode: "vertical" }),
      shell: frame("shell", "artboard", 0, 0, 390, 844, {
        layoutMode: "vertical",
        codeClassName: "pml-more",
      }),
      card: frame("card", "shell", 16, 120, 358, 76, {
        layoutMode: "horizontal",
        layoutGap: 8,
        codeClassName: "pml-more-theme-card",
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["artboard"],
      artboard: ["shell"],
      shell: ["card"],
      card: [],
    };

    synthesizeWebImportAutoLayout(nodes, childOrder);
    assert.equal(nodes.artboard?.layoutMode, "none");
    assert.equal(nodes.shell?.layoutMode, "none");
  });

  it("synthesizes uniform vertical stacks with measured gap", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, 0, 0, 390, 844, { codeClassName: "pml-more" }),
      stack: frame("stack", "screen", 0, 100, 390, 200, { layoutMode: "vertical" }),
      a: frame("a", "stack", 16, 0, 358, 40),
      b: frame("b", "stack", 16, 56, 358, 40),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["stack"],
      stack: ["a", "b"],
    };

    synthesizeWebImportAutoLayout(nodes, childOrder);
    assert.equal(nodes.stack?.layoutGap, 16);
    assert.equal(nodes.a?.layoutPositioning, "auto");
    assert.equal(nodes.a?.y, 0);
    assert.equal(nodes.b?.y, 56);
  });

  it("falls back to absolute when cross-axis alignment is inconsistent", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, 0, 0, 390, 844, { codeClassName: "pml-more" }),
      bar: frame("bar", "screen", 0, 0, 390, 44, { layoutMode: "horizontal" }),
      logo: frame("logo", "bar", 0, 6, 34, 34),
      rhs: frame("rhs", "bar", 310, 2, 80, 40),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["bar"],
      bar: ["logo", "rhs"],
    };

    synthesizeWebImportAutoLayout(nodes, childOrder);
    assert.equal(nodes.logo?.layoutPositioning, "absolute");
    assert.equal(nodes.rhs?.layoutPositioning, "absolute");
    assert.equal(nodes.logo?.x, 0);
    assert.equal(nodes.rhs?.x, 310);
  });
});

describe("finalizeWebImportGraph synthesis", () => {
  it("preserves header bar positions after finalize", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, 0, 0, 390, 844, { codeClassName: "pml-more" }),
      bar: frame("bar", "screen", 0, 0, 390, 44, {
        layoutMode: "horizontal",
        codeClassName: "sh",
      }),
      logo: frame("logo", "bar", 0, 6, 34, 34),
      rhs: frame("rhs", "bar", 310, 2, 80, 40),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["bar"],
      bar: ["logo", "rhs"],
    };

    finalizeWebImportGraph(nodes, childOrder, 390, 844);
    assert.equal(nodes.screen?.layoutMode, "none");
    assert.equal(nodes.logo?.x, 0);
    assert.equal(nodes.rhs?.x, 310);
  });
});
