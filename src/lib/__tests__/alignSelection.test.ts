import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  alignNodesInDocument,
  alignNodesInDocumentToGrid,
  alignParentIdForSelection,
  applyAlignToNodes,
  applyDistributeToNodes,
  canAlignSelection,
  suspendAutoLayoutForManualPosition,
} from "@/lib/alignSelection";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import { layoutFromLineEndpoints } from "@/lib/shapes/lineGeometry";

const childOrderRoot = (ids: string[]) => ({ [EDITOR_ROOT_KEY]: ids });

function rect(id: string, x: number, y: number, w: number, h: number, rot?: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: rot ?? 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

describe("applyAlignToNodes", () => {
  it("aligns left edges in world space", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 10, 20, 40, 30),
      b: rect("b", 80, 50, 30, 20),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const out = applyAlignToNodes(nodes, childOrder, ["a", "b"], "left");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.equal(ba.x, bb.x);
  });

  it("aligns rotated layers by visual bounds", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 100, 40, 0),
      b: rect("b", 200, 0, 100, 40, 45),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const out = applyAlignToNodes(nodes, childOrder, ["a", "b"], "top");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.ok(Math.abs(ba.y - bb.y) < 0.5, `expected same top, got ${ba.y} vs ${bb.y}`);
  });

  it("aligns children inside an offset frame", () => {
    const nodes: Record<string, EditorNode> = {
      frame: {
        ...rect("frame", 100, 50, 400, 300),
        type: "frame",
        name: "Frame",
      },
      a: { ...rect("a", 10, 20, 40, 30), parentId: "frame" },
      b: { ...rect("b", 120, 80, 30, 20), parentId: "frame" },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["a", "b"] };
    const out = applyAlignToNodes(nodes, childOrder, ["a", "b"], "left");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.equal(ba.x, bb.x);
  });

  it("aligns diagonal lines by rendered stroke bounds", () => {
    const lineLayout = layoutFromLineEndpoints(30, 40, 150, 120, 2);
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 10, 10, 50, 40),
      line: {
        id: "line",
        parentId: null,
        type: "line",
        name: "Line",
        visible: true,
        locked: false,
        expanded: true,
        strokeWidth: 2,
        ...lineLayout,
      },
    };
    const childOrder = childOrderRoot(["a", "line"]);
    const out = applyAlignToNodes(nodes, childOrder, ["a", "line"], "left");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bl = getRenderedWorldBounds("line", out, childOrder);
    assert.ok(Math.abs(ba.x - bl.x) < 0.5, `left edges ${ba.x} vs ${bl.x}`);
  });

  it("aligns text layers by rendered box bounds", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 80, 40),
      t: {
        id: "t",
        parentId: null,
        type: "text",
        name: "Text",
        x: 120,
        y: 30,
        width: 100,
        height: 48,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Hello",
        fontSize: 14,
        textAlign: "left",
      },
    };
    const childOrder = childOrderRoot(["a", "t"]);
    const out = applyAlignToNodes(nodes, childOrder, ["a", "t"], "top");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bt = getRenderedWorldBounds("t", out, childOrder);
    assert.ok(Math.abs(ba.y - bt.y) < 0.5);
  });

  it("uses childOrder parent tree when parentId is stale", () => {
    const nodes: Record<string, EditorNode> = {
      frame: {
        ...rect("frame", 200, 100, 400, 300),
        type: "frame",
        name: "Frame",
      },
      a: { ...rect("a", 20, 30, 40, 30), parentId: null },
      b: { ...rect("b", 140, 90, 30, 20), parentId: null },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["a", "b"] };
    const out = applyAlignToNodes(nodes, childOrder, ["a", "b"], "left");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.ok(Math.abs(ba.x - bb.x) < 0.5);
  });
});

describe("applyDistributeToNodes", () => {
  it("distributes horizontal spacing by rendered bounds", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30),
      b: rect("b", 200, 0, 40, 30),
      c: rect("c", 400, 0, 40, 30),
    };
    const childOrder = childOrderRoot(["a", "b", "c"]);
    const out = applyDistributeToNodes(nodes, childOrder, ["a", "b", "c"], "horizontal");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    const bc = getRenderedWorldBounds("c", out, childOrder);
    const gap1 = bb.x - (ba.x + ba.width);
    const gap2 = bc.x - (bb.x + bb.width);
    assert.ok(Math.abs(gap1 - gap2) < 0.5);
  });

  it("distributes vertical spacing by rendered bounds", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30),
      b: rect("b", 0, 120, 40, 30),
      c: rect("c", 0, 260, 40, 30),
    };
    const childOrder = childOrderRoot(["a", "b", "c"]);
    const out = applyDistributeToNodes(nodes, childOrder, ["a", "b", "c"], "vertical");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    const bc = getRenderedWorldBounds("c", out, childOrder);
    const gap1 = bb.y - (ba.y + ba.height);
    const gap2 = bc.y - (bb.y + bb.height);
    assert.ok(Math.abs(gap1 - gap2) < 0.5);
  });

  it("distributes rotated layers using visual bounds", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30, 0),
      b: rect("b", 200, 0, 40, 30, 45),
      c: rect("c", 420, 0, 40, 30, 0),
    };
    const childOrder = childOrderRoot(["a", "b", "c"]);
    const out = applyDistributeToNodes(nodes, childOrder, ["a", "b", "c"], "horizontal");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    const bc = getRenderedWorldBounds("c", out, childOrder);
    const gap1 = bb.x - (ba.x + ba.width);
    const gap2 = bc.x - (bb.x + bb.width);
    assert.ok(Math.abs(gap1 - gap2) < 1);
    assert.ok(Math.abs(ba.x - getRenderedWorldBounds("a", nodes, childOrder).x) < 1);
    assert.ok(
      Math.abs(bc.x + bc.width - (getRenderedWorldBounds("c", nodes, childOrder).x + getRenderedWorldBounds("c", nodes, childOrder).width)) < 1,
    );
  });
});

describe("suspendAutoLayoutForManualPosition", () => {
  it("disables auto-layout on the shared parent", () => {
    const nodes: Record<string, EditorNode> = {
      parent: {
        ...rect("parent", 0, 0, 200, 200),
        type: "frame",
        layoutMode: "horizontal",
        layoutGap: 8,
      },
      a: { ...rect("a", 0, 0, 40, 40), parentId: "parent" },
      b: { ...rect("b", 60, 0, 40, 40), parentId: "parent" },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["parent"], parent: ["a", "b"] };
    const out = suspendAutoLayoutForManualPosition(nodes, childOrder, ["a", "b"]);
    assert.equal(out.parent?.layoutMode, "none");
  });
});

describe("align to parent frame", () => {
  it("allows aligning a single child to its parent frame", () => {
    const nodes: Record<string, EditorNode> = {
      frame: {
        ...rect("frame", 100, 50, 400, 300),
        type: "frame",
        name: "Frame",
      },
      shape: { ...rect("shape", 80, 120, 40, 30), parentId: "frame" },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["shape"] };
    assert.equal(alignParentIdForSelection(["shape"], nodes, childOrder), "frame");
    assert.equal(canAlignSelection(["shape"], nodes, childOrder), true);
    const out = alignNodesInDocument(nodes, childOrder, ["shape"], "center-h");
    const bs = getRenderedWorldBounds("shape", out, childOrder);
    const bf = getRenderedWorldBounds("frame", out, childOrder);
    const shapeCenter = bs.x + bs.width / 2;
    const frameCenter = bf.x + bf.width / 2;
    assert.ok(Math.abs(shapeCenter - frameCenter) < 0.5);
  });

  it("aligns a single text layer to the top of its parent frame", () => {
    const nodes: Record<string, EditorNode> = {
      frame: {
        ...rect("frame", 0, 0, 200, 160),
        type: "frame",
        name: "Frame",
        paddingTop: 12,
        paddingLeft: 8,
      },
      text: {
        id: "text",
        parentId: "frame",
        type: "text",
        name: "Label",
        x: 40,
        y: 50,
        width: 80,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Hello",
        fontSize: 14,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["text"] };
    const out = applyAlignToNodes(nodes, childOrder, ["text"], "top");
    const bt = getRenderedWorldBounds("text", out, childOrder);
    const bf = getRenderedWorldBounds("frame", out, childOrder);
    assert.ok(Math.abs(bt.y - (bf.y + 12)) < 0.5);
  });
});

describe("alignNodesInDocument", () => {
  it("aligns siblings inside an auto-layout frame", () => {
    const nodes: Record<string, EditorNode> = {
      parent: {
        ...rect("parent", 0, 0, 300, 120),
        type: "frame",
        layoutMode: "horizontal",
        layoutGap: 16,
        paddingLeft: 8,
        paddingTop: 8,
      },
      a: { ...rect("a", 8, 8, 50, 40), parentId: "parent" },
      b: { ...rect("b", 90, 8, 50, 40), parentId: "parent" },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["parent"], parent: ["a", "b"] };
    const out = alignNodesInDocument(nodes, childOrder, ["a", "b"], "top");
    assert.equal(out.parent?.layoutMode, "none");
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.ok(Math.abs(ba.y - bb.y) < 0.5);
  });
});

describe("alignNodesInDocumentToGrid", () => {
  it("aligns selection to top-left in one pass", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 40, 60, 40, 30),
      b: rect("b", 120, 90, 30, 20),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const out = alignNodesInDocumentToGrid(nodes, childOrder, ["a", "b"], 0, 0);
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.equal(ba.x, bb.x);
    assert.equal(ba.y, bb.y);
  });
});
