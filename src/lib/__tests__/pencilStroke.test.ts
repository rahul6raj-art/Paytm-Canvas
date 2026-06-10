import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";
import { pathToSvgD } from "@/lib/pathGeometry";
import { useEditorStore } from "@/stores/useEditorStore";

describe("pencil stroke", () => {
  it("creates, extends, and finishes a freehand path", () => {
    const store = useEditorStore.getState();
    store.setTool("pencil");
    store.startPencilStroke({ x: 100, y: 100 });

    const s1 = useEditorStore.getState();
    assert.equal(s1.tool, "pencil");
    assert.ok(s1.pencilDrawingNodeId);
    const id = s1.pencilDrawingNodeId!;
    const n0 = s1.nodes[id];
    assert.ok(n0);
    assert.equal(n0.type, "path");
    assert.equal(n0.pathPoints?.length, 1);

    for (let i = 1; i <= 10; i++) {
      store.extendPencilStrokeCoalesced([{ x: 100 + i * 10, y: 100 + i * 5 }]);
    }

    const s2 = useEditorStore.getState();
    assert.equal(s2.pencilDrawingNodeId, id);
    const n1 = s2.nodes[id];
    assert.ok((n1.pathPoints?.length ?? 0) >= 2);

    store.finishPencilStroke();

    const s3 = useEditorStore.getState();
    assert.equal(s3.pencilDrawingNodeId, null);
    assert.equal(s3.tool, "move");
    assert.deepEqual(s3.selectedIds, [id]);
    const finished = s3.nodes[id];
    assert.ok(finished);
    assert.ok((finished.pathPoints?.length ?? 0) >= 2);
    const origin = getRenderedWorldTopLeft(id, s3.nodes, s3.childOrder);
    const d = pathToSvgD(finished.pathPoints ?? [], false);
    assert.ok(d.length > 0);
    assert.equal(origin.x, 100);
    assert.equal(origin.y, 100);
  });

  it("keeps a tap-only stroke as a visible mark", () => {
    const store = useEditorStore.getState();
    store.setTool("pencil");
    store.startPencilStroke({ x: 80, y: 80 });
    store.extendPencilStrokeCoalesced([{ x: 80, y: 80 }]);

    store.finishPencilStroke();

    const s = useEditorStore.getState();
    const id = s.selectedIds[0];
    assert.ok(id);
    const finished = s.nodes[id!];
    assert.ok(finished);
    assert.ok((finished.pathPoints?.length ?? 0) >= 2);
  });

  it("recovers from a stale in-progress pencil session", () => {
    const store = useEditorStore.getState();
    store.setTool("pencil");
    store.startPencilStroke({ x: 50, y: 50 });

    const staleId = useEditorStore.getState().pencilDrawingNodeId;
    assert.ok(staleId);

    store.startPencilStroke({ x: 200, y: 200 });

    const s = useEditorStore.getState();
    assert.equal(s.tool, "pencil");
    assert.ok(s.pencilDrawingNodeId);
    assert.notEqual(s.pencilDrawingNodeId, staleId);
    assert.equal(s.nodes[staleId], undefined);
    assert.ok(s.nodes[s.pencilDrawingNodeId!]);
  });
});
