import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWrapSelectionInFrame } from "@/lib/autoLayoutSelection";
import { getNodeWorldOrigin } from "@/lib/transformMath";
import { canUngroupSelection } from "@/lib/ungroupSelection";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function textNode(id: string, x: number, y: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "text",
    name: "Text",
    x,
    y,
    width: 120,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Hello",
    textResizeMode: "auto-width",
    fillEnabled: true,
    fill: "#ffffff",
    textColor: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: 400,
  };
}

describe("ungroup frame", () => {
  it("releases text children from a wrapped frame back to the parent", () => {
    const textId = `text-${Date.now()}`;
    useEditorStore.setState({
      editorMode: "design",
      nodes: { [textId]: textNode(textId, 100, 80) },
      childOrder: { [ROOT]: [textId] },
      selectedIds: [textId],
    });

    const beforeWrap = useEditorStore.getState();
    const worldBefore = getNodeWorldOrigin(textId, beforeWrap.nodes);

    const wrapped = applyWrapSelectionInFrame(
      beforeWrap.nodes,
      beforeWrap.childOrder,
      [textId],
    );
    assert.ok(wrapped);
    useEditorStore.setState({
      nodes: wrapped.nodes,
      childOrder: wrapped.childOrder,
      selectedIds: wrapped.selectedIds,
    });

    const frameId = wrapped.selectedIds[0]!;
    const afterWrap = useEditorStore.getState();
    assert.equal(afterWrap.nodes[textId]?.parentId, frameId);
    assert.equal(canUngroupSelection(afterWrap), true);

    useEditorStore.getState().ungroupSelection();
    const st = useEditorStore.getState();

    assert.equal(st.nodes[frameId], undefined);
    assert.equal(st.nodes[textId]?.parentId, null);
    assert.ok(st.childOrder[ROOT]?.includes(textId));
    assert.equal(st.childOrder[ROOT]?.includes(frameId), false);
    assert.deepEqual(st.selectedIds, [textId]);

    const worldAfter = getNodeWorldOrigin(textId, st.nodes);
    assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 0.5);
    assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 0.5);
  });

  it("does not ungroup empty frames", () => {
    const frameId = `frame-${Date.now()}`;
    useEditorStore.setState({
      editorMode: "design",
      nodes: {
        [frameId]: {
          id: frameId,
          parentId: null,
          type: "frame",
          name: "Frame",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [frameId], [frameId]: [] },
      selectedIds: [frameId],
    });

    assert.equal(canUngroupSelection(useEditorStore.getState()), false);
    useEditorStore.getState().ungroupSelection();
    assert.ok(useEditorStore.getState().nodes[frameId]);
  });
});
