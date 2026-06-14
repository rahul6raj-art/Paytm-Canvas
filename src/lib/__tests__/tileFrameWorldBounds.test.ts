import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { getRenderedWorldBounds, getRenderedWorldTopLeft } from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

function mk(
  id: string,
  partial: Partial<EditorNode> & Pick<EditorNode, "x" | "y" | "width" | "height">,
): EditorNode {
  return {
    id,
    type: "rectangle",
    parentId: null,
    visible: true,
    locked: false,
    name: id,
    rotation: 0,
    expanded: true,
    ...partial,
  };
}

describe("mock marketing frame world bounds", () => {
  it("nested hero visual world x matches frame + group + local", () => {
    const nodes: Record<string, EditorNode> = {
      frame: mk("frame", { type: "frame", x: 520, y: 80, width: 1280, height: 720 }),
      hero: mk("hero", { type: "group", parentId: "frame", x: 80, y: 120, width: 1120, height: 280 }),
      visual: mk("visual", { parentId: "hero", x: 560, y: 0, width: 560, height: 280, fill: "#f1f5f9" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["frame"],
      frame: ["hero"],
      hero: ["visual"],
    };
    const tl = getRenderedWorldTopLeft("visual", nodes, childOrder);
    assert.equal(tl.x, 520 + 80 + 560);
    assert.equal(tl.y, 80 + 120 + 0);
    const b = getRenderedWorldBounds("visual", nodes, childOrder);
    assert.equal(b.x, 1160);
    assert.equal(b.y, 200);
  });
});
