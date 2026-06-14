import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("craftEngineWasmFirstShapeInsert", () => {
  it("addEllipseAt inserts a node into the document tree", () => {
    const before = Object.keys(useEditorStore.getState().nodes).length;
    useEditorStore.getState().addEllipseAt(200, 300);
    const st = useEditorStore.getState();
    assert.ok(Object.keys(st.nodes).length > before);
    const inserted = Object.values(st.nodes).find((n) => n.type === "ellipse");
    assert.ok(inserted);
    const parentKey = inserted.parentId ?? ROOT;
    assert.ok(st.childOrder[parentKey]?.includes(inserted.id));
  });

  it("startShapeFromDrag opens a shape drawing session", () => {
    useEditorStore.setState({ editorMode: "design", shapeDrawingSession: null });
    useEditorStore.getState().startShapeFromDrag("rectangle", { x: 10, y: 20 }, { shiftKey: false, altKey: false });
    const st = useEditorStore.getState();
    assert.ok(st.shapeDrawingSession);
    assert.equal(st.shapeDrawingSession?.shapeType, "rectangle");
    assert.ok(st.nodes[st.shapeDrawingSession!.nodeId]);
  });

  it("startShapeFromDrag parents the draft into a frame under the click", () => {
    const frameId = "frame-test";
    useEditorStore.setState({
      editorMode: "design",
      shapeDrawingSession: null,
      nodes: {
        [frameId]: {
          id: frameId,
          parentId: null,
          type: "frame",
          name: "Frame 1",
          x: 0,
          y: 0,
          width: 400,
          height: 400,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [frameId], [frameId]: [] },
      selectedIds: [],
    });
    useEditorStore.getState().startShapeFromDrag(
      "rectangle",
      { x: 120, y: 140 },
      { shiftKey: false, altKey: false },
    );
    const st = useEditorStore.getState();
    const draftId = st.shapeDrawingSession!.nodeId;
    assert.equal(st.nodes[draftId]!.parentId, frameId);
    assert.ok(st.childOrder[frameId]?.includes(draftId));
  });

  it("cancelShapeFromDrag removes the draft node", () => {
    useEditorStore.setState({ editorMode: "design", shapeDrawingSession: null });
    useEditorStore.getState().startShapeFromDrag("rectangle", { x: 10, y: 20 }, { shiftKey: false, altKey: false });
    const draftId = useEditorStore.getState().shapeDrawingSession!.nodeId;
    useEditorStore.getState().cancelShapeFromDrag();
    const st = useEditorStore.getState();
    assert.equal(st.shapeDrawingSession, null);
    assert.equal(st.nodes[draftId], undefined);
  });
});
