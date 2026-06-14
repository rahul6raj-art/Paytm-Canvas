import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { promoteInferredAutoLayout } from "../promoteInferredAutoLayout";

function frame(id: string, x: number, y: number, w: number, h: number, extra?: Partial<EditorNode>): EditorNode {
  return {
    id,
    parentId: null,
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

describe("promoteInferredAutoLayout", () => {
  it("promotes side-by-side children to horizontal auto layout", () => {
    const nodes: Record<string, EditorNode> = {
      parent: frame("parent", 0, 0, 1200, 800, { layoutMode: "none" }),
      left: frame("left", 0, 0, 600, 800),
      right: frame("right", 620, 0, 580, 800),
    };
    const childOrder = { parent: ["left", "right"] };

    const next = promoteInferredAutoLayout(nodes, childOrder);
    assert.equal(next.parent?.layoutMode, "horizontal");
    assert.equal(next.left?.x, 0);
    assert.equal(next.right?.x, 620);
  });
});

describe("frame label scope", () => {
  it("only top-level artboards qualify for canvas labels", () => {
    const canvasRoots = new Set(["page"]);
    const artboardIds = new Set(["section-a", "section-b"]);
    const nodes: Record<string, EditorNode> = {
      page: frame("page", 0, 0, 1440, 900),
      "section-a": frame("section-a", 0, 0, 600, 900, { codeJsxTag: "div", codeJsxIntrinsic: true }),
      "section-b": frame("section-b", 600, 0, 840, 900, { codeJsxTag: "div", codeJsxIntrinsic: true }),
      "nested-btn": frame("nested-btn", 10, 10, 120, 40),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["page"],
      page: ["section-a", "section-b"],
      "section-a": ["nested-btn"],
    };

    const canvasRootsList = childOrder[EDITOR_ROOT_KEY] ?? [];
    const artboards = new Set<string>();
    for (const rootId of canvasRootsList) {
      for (const childId of childOrder[rootId] ?? []) artboards.add(childId);
    }

    const labelIds = Object.values(nodes)
      .filter((n) => {
        if (n.type !== "frame" || !n.visible) return false;
        if (canvasRoots.has(n.id)) return true;
        if (artboardIds.has(n.id)) {
          if (n.codeJsxTag || n.codeClassName) return false;
          return n.width >= 200 && n.height >= 120;
        }
        return false;
      })
      .map((n) => n.id);

    assert.deepEqual(labelIds.sort(), ["page"]);
    assert.ok(!labelIds.includes("section-a"));
    assert.ok(!labelIds.includes("section-b"));
  });
});
