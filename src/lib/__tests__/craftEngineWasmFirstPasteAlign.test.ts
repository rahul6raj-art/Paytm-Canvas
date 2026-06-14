import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("craftEngineWasmFirstPasteAlign", () => {
  it("alignSelection updates node positions", () => {
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [a]: {
          id: a,
          parentId: null,
          type: "rectangle",
          name: "A",
          x: 10,
          y: 20,
          width: 40,
          height: 30,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
        [b]: {
          id: b,
          parentId: null,
          type: "rectangle",
          name: "B",
          x: 80,
          y: 50,
          width: 30,
          height: 20,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [a, b] },
      selectedIds: [a, b],
    });
    const xBefore = useEditorStore.getState().nodes[b]!.x;
    useEditorStore.getState().alignSelection("left");
    const xAfter = useEditorStore.getState().nodes[b]!.x;
    assert.notEqual(xBefore, xAfter);
  });

  it("pasteSelection inserts clipboard nodes", () => {
    const src = `rect-src-${Date.now()}`;
    useEditorStore.setState({
      editorMode: "design",
      nodes: {
        [src]: {
          id: src,
          parentId: null,
          type: "rectangle",
          name: "Source",
          x: 40,
          y: 40,
          width: 60,
          height: 40,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [src] },
      selectedIds: [src],
    });
    const before = Object.keys(useEditorStore.getState().nodes).length;
    useEditorStore.getState().copySelection();
    useEditorStore.getState().pasteSelection();
    assert.ok(Object.keys(useEditorStore.getState().nodes).length > before);
  });
});
