import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

function baseRect(id: string, x = 0, y = 0) {
  return {
    id,
    parentId: null,
    type: "rectangle" as const,
    name: "Rect",
    x,
    y,
    width: 80,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#000000",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center" as const,
  };
}

describe("craftEngineWasmFirstMetadataGroup", () => {
  it("renameNode updates layer name", () => {
    const id = `rect-rename-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().renameNode(id, "Hero");
    assert.equal(useEditorStore.getState().nodes[id]?.name, "Hero");
  });

  it("addEffect appends node-level effect", () => {
    const id = `rect-fx-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().addEffect(id, "drop-shadow");
    const effects = useEditorStore.getState().nodes[id]?.effects ?? [];
    assert.equal(effects.length, 1);
    assert.equal(effects[0]?.type, "drop-shadow");
  });

  it("groupSelection wraps siblings in a group", () => {
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [a]: baseRect(a, 0, 0),
        [b]: baseRect(b, 100, 0),
      },
      childOrder: { [ROOT]: [a, b] },
      selectedIds: [a, b],
    });
    useEditorStore.getState().groupSelection();
    const gid = useEditorStore.getState().selectedIds[0]!;
    const group = useEditorStore.getState().nodes[gid];
    assert.equal(group?.type, "group");
    assert.equal(useEditorStore.getState().nodes[a]?.parentId, gid);
    assert.equal(useEditorStore.getState().nodes[b]?.parentId, gid);
  });

  it("setPathHandleMirroring updates path node", () => {
    const id = `path-mirror-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "path",
          name: "Path",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          pathPoints: [],
          pathClosed: false,
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
      pathEditModeNodeId: id,
    });
    useEditorStore.getState().setPathHandleMirroring("angle");
    assert.equal(useEditorStore.getState().nodes[id]?.pathHandleMirroring, "angle");
  });
});
