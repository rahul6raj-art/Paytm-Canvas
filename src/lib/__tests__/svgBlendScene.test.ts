import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: "Frame",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: "none",
    fillEnabled: true,
    fill: "#ffffff",
    ...extra,
  };
}

function rect(
  id: string,
  parentId: string,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x: 20,
    y: 20,
    width: 80,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: true,
    fill: "#ff0000",
    ...extra,
  };
}

describe("buildSvgScene — layer blend modes", () => {
  it("applies mix-blend-mode to layered shapes in SVG output", () => {
    const f = "frame-1";
    const a = "rect-a";
    const b = "rect-b";
    const nodes: Record<string, EditorNode> = {
      [f]: frame(f),
      [a]: rect(a, f, { blendMode: "multiply", fill: "#ff0000" }),
      [b]: rect(b, f, { x: 40, y: 40, fill: "#0000ff" }),
    };
    const childOrder = { [f]: [a, b] };

    const scene = buildSvgScene({ rootIds: [f], nodes, childOrder });
    assert.match(scene.body, /mix-blend-mode:multiply/);
  });

  it("isolates normal blend frames", () => {
    const f = "frame-1";
    const nodes: Record<string, EditorNode> = {
      [f]: frame(f, { blendMode: "normal" }),
    };

    const scene = buildSvgScene({ rootIds: [f], nodes, childOrder: {} });
    assert.match(scene.body, /isolation:isolate/);
  });
});
