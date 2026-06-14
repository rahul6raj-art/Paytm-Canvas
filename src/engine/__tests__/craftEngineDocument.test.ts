import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import type { EditorNode } from "@/stores/useEditorStore";

function node(id: string, overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    type: "rectangle",
    parentId: null,
    name: id,
    x: 0,
    y: 0,
    width: 80,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...overrides,
  };
}

describe("engine/craftEngineDocument", () => {
  it("builds a minimal GPU document slice from store fields", () => {
    const doc = craftEngineDocumentFromStore({
      nodes: {
        a: node("a", { fill: "#ff0000" }),
        frame: node("frame", { type: "frame", width: 200, height: 200 }),
      },
      childOrder: {
        __root__: ["frame"],
        frame: ["a"],
      },
    });

    assert.deepEqual(doc.rootIds, ["frame"]);
    assert.equal(doc.nodes.a?.fill, "#ff0000");
    assert.deepEqual(doc.childOrder.frame, ["a"]);
  });
});
