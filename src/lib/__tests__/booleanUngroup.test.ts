import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { getNodeWorldOrigin } from "@/lib/transformMath";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function rect(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: 80,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#3366ff",
    fillEnabled: true,
    strokePosition: "center",
  } as EditorNode;
}

describe("ungroup boolean group", () => {
  it("releases operands as independent layers and clears object edit mode", () => {
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      editorMode: "design",
      nodes: { [a]: rect(a, null, 0, 0), [b]: rect(b, null, 40, 20) },
      childOrder: { [ROOT]: [a, b] },
      selectedIds: [a, b],
      objectEditModeNodeId: null,
    });

    const worldBefore = {
      [a]: getNodeWorldOrigin(a, useEditorStore.getState().nodes),
      [b]: getNodeWorldOrigin(b, useEditorStore.getState().nodes),
    };

    useEditorStore.getState().createBooleanGroup("union");
    const afterCreate = useEditorStore.getState();
    const gid = afterCreate.selectedIds[0]!;
    assert.ok(afterCreate.nodes[gid]?.isBooleanGroup);

    useEditorStore.getState().enterObjectEditMode(gid);
    assert.equal(useEditorStore.getState().objectEditModeNodeId, gid);

    useEditorStore.getState().ungroupSelection();
    const st = useEditorStore.getState();

    assert.equal(st.nodes[gid], undefined);
    assert.equal(
      Object.values(st.nodes).some((n) => n.isBooleanGroup),
      false,
    );
    assert.deepEqual(st.selectedIds.sort(), [a, b].sort());
    assert.equal(st.childOrder[ROOT]?.includes(gid), false);
    assert.ok(st.childOrder[ROOT]?.includes(a));
    assert.ok(st.childOrder[ROOT]?.includes(b));
    assert.equal(st.nodes[a]?.parentId, null);
    assert.equal(st.nodes[b]?.parentId, null);
    assert.equal(st.objectEditModeNodeId, null);

    for (const id of [a, b] as const) {
      const after = getNodeWorldOrigin(id, st.nodes);
      assert.ok(Math.abs(after.x - worldBefore[id].x) < 0.5);
      assert.ok(Math.abs(after.y - worldBefore[id].y) < 0.5);
    }

    const scene = buildSvgScene({
      rootIds: st.childOrder[EDITOR_ROOT_KEY] ?? st.childOrder[ROOT] ?? [],
      nodes: st.nodes,
      childOrder: st.childOrder,
    });
    assert.equal((scene.body.match(/<path d="/g) ?? []).length, 0);
    assert.equal((scene.body.match(/<rect /g) ?? []).length, 2);
  });
});
