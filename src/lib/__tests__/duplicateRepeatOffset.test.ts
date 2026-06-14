import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { clonedNodePosition } from "@/lib/editorGraph";
import {
  getDuplicateStepOffset,
  recordDuplicateCreated,
  refreshDuplicateStepAfterMove,
  resetDuplicateRepeatOffset,
  selectionMatchesDuplicateChain,
  syncDuplicateRepeatSelection,
} from "@/lib/duplicateRepeatOffset";
import type { EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";

function rect(id: string, x: number, y: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x,
    y,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ccc",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("duplicateRepeatOffset", () => {
  beforeEach(() => {
    resetDuplicateRepeatOffset();
  });

  it("records anchors and learns step after move", () => {
    const nodes = { a: rect("a", 0, 0), b: rect("b", 0, 0) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    recordDuplicateCreated(["b"], nodes, childOrder);
    assert.equal(selectionMatchesDuplicateChain(["b"]), true);
    assert.equal(getDuplicateStepOffset(["b"]), null);

    nodes.b = { ...nodes.b!, x: 50, y: 30 };
    refreshDuplicateStepAfterMove(["b"], nodes, childOrder);
    assert.deepEqual(getDuplicateStepOffset(["b"]), { dx: 50, dy: 30 });
  });

  it("clears state when selection leaves the duplicate chain", () => {
    const nodes = { a: rect("a", 0, 0), b: rect("b", 0, 0) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    recordDuplicateCreated(["b"], nodes, childOrder);
    syncDuplicateRepeatSelection(["a"], nodes);
    assert.equal(selectionMatchesDuplicateChain(["b"]), false);
  });

  it("does not learn step until node positions reflect the drag commit", () => {
    const nodes = { b: rect("b", 0, 0) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["b"] };
    recordDuplicateCreated(["b"], nodes, childOrder);

    refreshDuplicateStepAfterMove(["b"], nodes, childOrder);
    assert.equal(getDuplicateStepOffset(["b"]), null);

    nodes.b = { ...nodes.b!, x: 50, y: 30 };
    refreshDuplicateStepAfterMove(["b"], nodes, childOrder);
    assert.deepEqual(getDuplicateStepOffset(["b"]), { dx: 50, dy: 30 });
  });

  it("clonedNodePosition applies world step for repeat duplicate", () => {
    const nodes = { a: rect("a", 100, 100) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const step = { dx: 40, dy: 20 };
    const pos = clonedNodePosition("a", true, step, nodes, childOrder, null, nodes.a!);
    assert.deepEqual(pos, { x: 140, y: 120 });
  });
});

describe("cloneSelectionInPlace vs Cmd+D repeat", () => {
  beforeEach(() => {
    resetDuplicateRepeatOffset();
  });

  it("cloneSelectionInPlace copies on top without repeat offset", () => {
    const a = "rect-a";
    const b = "rect-b";
    useEditorStore.setState({
      nodes: {
        [a]: rect(a, 0, 0),
        [b]: rect(b, 0, 0),
      },
      childOrder: { [EDITOR_ROOT_KEY]: [a, b] },
      selectedIds: [a],
      editorMode: "design",
    });
    useEditorStore.getState().duplicateSelection();
    let st = useEditorStore.getState();
    const dupId = st.selectedIds[0]!;
    assert.notEqual(dupId, a);
    useEditorStore.getState().updateNode(dupId, { x: 50, y: 30 }, { skipHistory: true });
    st = useEditorStore.getState();
    assert.deepEqual(getDuplicateStepOffset([dupId]), { dx: 50, dy: 30 });

    st = useEditorStore.getState();
    const before = { x: st.nodes[dupId]!.x, y: st.nodes[dupId]!.y };
    useEditorStore.getState().cloneSelectionInPlace();
    st = useEditorStore.getState();
    const cloneId = st.selectedIds[0]!;
    assert.notEqual(cloneId, dupId);
    assert.equal(st.nodes[cloneId]?.x, before.x);
    assert.equal(st.nodes[cloneId]?.y, before.y);
    assert.deepEqual(getDuplicateStepOffset([dupId]), { dx: 50, dy: 30 });
  });
});
