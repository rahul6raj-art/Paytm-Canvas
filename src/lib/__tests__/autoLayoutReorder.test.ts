import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  flowInsertIndexToChildOrderIndex,
  getAutoLayoutReorderContext,
  insertIndexInAutoLayout,
  isAutoLayoutContainer,
  reorderChildByPointer,
  resolveAutoLayoutDropTarget,
} from "@/lib/autoLayoutReorder";
import type { LayoutNode } from "@/lib/autoLayout";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(
  id: string,
  extra: Partial<LayoutNode> = {},
): LayoutNode {
  return {
    id,
    type: "frame",
    parentId: extra.parentId ?? "parent",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("insertIndexInAutoLayout", () => {
  it("inserts before midpoint in horizontal flow", () => {
    const nodes: Record<string, LayoutNode> = {
      row: frame("row", {
        parentId: null,
        layoutMode: "horizontal",
        layoutGap: 10,
      }),
      a: frame("a", { parentId: "row", x: 0, width: 20 }),
      b: frame("b", { parentId: "row", x: 30, width: 20 }),
    };
    const childOrder = { row: ["a", "b"] };
    assert.equal(
      insertIndexInAutoLayout("row", nodes, childOrder, 5, 0, "b"),
      0,
    );
    assert.equal(
      insertIndexInAutoLayout("row", nodes, childOrder, 45, 0, "a"),
      2,
    );
  });

  it("inserts before midpoint in vertical flow", () => {
    const nodes: Record<string, LayoutNode> = {
      col: frame("col", {
        parentId: null,
        layoutMode: "vertical",
      }),
      a: frame("a", { parentId: "col", y: 0, height: 10 }),
      b: frame("b", { parentId: "col", y: 20, height: 10 }),
    };
    const childOrder = { col: ["a", "b"] };
    assert.equal(
      insertIndexInAutoLayout("col", nodes, childOrder, 0, 4, "b"),
      0,
    );
    assert.equal(
      insertIndexInAutoLayout("col", nodes, childOrder, 0, 25, "b"),
      1,
    );
  });
});

describe("getAutoLayoutReorderContext", () => {
  it("returns context for single flow child in auto layout", () => {
    const nodes = {
      parent: frame("parent", { layoutMode: "horizontal" }),
      child: frame("child", { parentId: "parent" }),
    };
    const ctx = getAutoLayoutReorderContext(["child"], nodes, nodes);
    assert.ok(ctx);
    assert.equal(ctx!.parentId, "parent");
    assert.equal(ctx!.draggedId, "child");
  });

  it("returns null for absolute or manual parent", () => {
    const nodes = {
      parent: frame("parent", { layoutMode: "none" }),
      child: frame("child", { parentId: "parent", layoutPositioning: "absolute" }),
    };
    assert.equal(getAutoLayoutReorderContext(["child"], nodes, nodes), null);
  });
});

describe("flowInsertIndexToChildOrderIndex", () => {
  it("maps flow insert index to full child list when absolute child exists", () => {
    const nodes: Record<string, LayoutNode> = {
      row: frame("row", { parentId: null, layoutMode: "horizontal" }),
      abs: frame("abs", { parentId: "row", x: 0, width: 20, layoutPositioning: "absolute" }),
      a: frame("a", { parentId: "row", x: 12, width: 40 }),
      b: frame("b", { parentId: "row", x: 60, width: 40 }),
    };
    const childOrder = { row: ["abs", "a", "b"] };
    assert.equal(
      flowInsertIndexToChildOrderIndex("row", 0, nodes, childOrder, "horizontal", "b"),
      1,
    );
    assert.equal(
      flowInsertIndexToChildOrderIndex("row", 2, nodes, childOrder, "horizontal", "a"),
      3,
    );
  });
});

describe("reorderChildByPointer", () => {
  it("delegates to insertIndexInAutoLayout", () => {
    const nodes: Record<string, LayoutNode> = {
      row: frame("row", { parentId: null, layoutMode: "horizontal" }),
      a: frame("a", { parentId: "row", x: 0, width: 40 }),
      b: frame("b", { parentId: "row", x: 50, width: 40 }),
    };
    const childOrder = { row: ["a", "b"] };
    const ctx = { parentId: "row", draggedId: "b", mode: "horizontal" as const };
    assert.equal(reorderChildByPointer(ctx, nodes, childOrder, 10, 0), 0);
  });
});

describe("resolveAutoLayoutDropTarget", () => {
  function alCanvas(): {
    nodes: Record<string, EditorNode>;
    childOrder: Record<string, string[]>;
  } {
    const nodes: Record<string, EditorNode> = {
      stack: {
        id: "stack",
        parentId: null,
        type: "frame",
        name: "Stack",
        x: 100,
        y: 100,
        width: 200,
        height: 80,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        layoutMode: "horizontal",
        layoutGap: 10,
        paddingTop: 8,
        paddingRight: 8,
        paddingBottom: 8,
        paddingLeft: 8,
      },
      a: {
        id: "a",
        parentId: "stack",
        type: "rectangle",
        name: "A",
        x: 8,
        y: 8,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      b: {
        id: "b",
        parentId: "stack",
        type: "rectangle",
        name: "B",
        x: 58,
        y: 8,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      loose: {
        id: "loose",
        parentId: null,
        type: "rectangle",
        name: "Loose",
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
    };
    return {
      nodes,
      childOrder: {
        [EDITOR_ROOT_KEY]: ["stack", "loose"],
        stack: ["a", "b"],
      },
    };
  }

  it("resolves insert index when dropping onto auto-layout frame content", () => {
    const { nodes, childOrder } = alCanvas();
    const target = resolveAutoLayoutDropTarget(120, 120, nodes, childOrder, "loose", "loose");
    assert.ok(target);
    assert.equal(target!.parentId, "stack");
    assert.equal(target!.insertIndex, 0);
    assert.equal(target!.flowInsertIndex, 0);
  });

  it("resolves append index at end of flow", () => {
    const { nodes, childOrder } = alCanvas();
    const target = resolveAutoLayoutDropTarget(250, 120, nodes, childOrder, "loose", "loose");
    assert.ok(target);
    assert.equal(target!.parentId, "stack");
    assert.equal(target!.flowInsertIndex, 2);
  });

  it("returns null when dropping into dragged subtree", () => {
    const { nodes, childOrder } = alCanvas();
    nodes.nested = {
      id: "nested",
      parentId: null,
      type: "frame",
      name: "Nested",
      x: 400,
      y: 100,
      width: 120,
      height: 80,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      layoutMode: "vertical",
    };
    nodes.inner = {
      id: "inner",
      parentId: "nested",
      type: "rectangle",
      name: "Inner",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    };
    childOrder[EDITOR_ROOT_KEY] = ["stack", "loose", "nested"];
    childOrder.nested = ["inner"];
    const target = resolveAutoLayoutDropTarget(420, 120, nodes, childOrder, "nested", "nested");
    assert.equal(target, null);
  });
});

describe("isAutoLayoutContainer", () => {
  it("detects horizontal and vertical layout containers", () => {
    assert.equal(isAutoLayoutContainer(frame("f", { layoutMode: "horizontal" })), true);
    assert.equal(isAutoLayoutContainer(frame("f", { layoutMode: "vertical" })), true);
    assert.equal(isAutoLayoutContainer(frame("f", { layoutMode: "none" })), false);
  });
});
