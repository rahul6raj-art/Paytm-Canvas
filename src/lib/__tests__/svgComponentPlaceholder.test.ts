import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildSvgScene } from "@/lib/svgSceneMarkup";

function frame(id: string, parentId: string | null, extra?: Partial<EditorNode>): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 376,
    height: 112,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#e2e8f0",
    fillEnabled: true,
    ...extra,
  };
}

describe("buildSvgScene component placeholders", () => {
  it("does not paint placeholder labels when a component frame has children", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, { height: 844 }),
      header: frame("header", "root", {
        codeJsxTag: "Header",
        codeJsxIntrinsic: false,
        height: 112,
      }),
      title: frame("title", "header", {
        x: 16,
        y: 48,
        width: 80,
        height: 24,
        fill: "#111111",
        fillEnabled: true,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["header"],
      header: ["title"],
    };

    const scene = buildSvgScene({ rootIds: ["root"], nodes, childOrder });
    assert.equal(scene.body.includes(">Header<"), false);
    assert.ok(scene.body.includes('data-node-id="title"') || scene.body.includes("<rect"));
  });

  it("paints placeholder label for empty component shells from source parse", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, { height: 844 }),
      header: frame("header", "root", {
        codeJsxTag: "Header",
        codeJsxIntrinsic: false,
        height: 112,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["header"],
      header: [],
    };

    const scene = buildSvgScene({ rootIds: ["root"], nodes, childOrder });
    assert.equal(scene.body.includes(">Header<"), true);
  });
});
