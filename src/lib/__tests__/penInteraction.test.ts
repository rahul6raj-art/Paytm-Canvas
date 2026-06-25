import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { canClosePathAt, resolvePenClickAnchor } from "@/lib/penTool/placement";
import {
  resolvePenEscapeAction,
  resolvePenLivePreviewTarget,
  resolvePenPointCommit,
  resolvePenToolSwitchAction,
  shouldPenEnterFinish,
  shouldShowPenDrawingOverlay,
} from "@/lib/penTool/penInteraction";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";
import { penPreviousWorldAnchor } from "@/components/editor/PenDrawingOverlay";

function resetPenStore() {
  useEditorStore.setState({
    editorMode: "design",
    tool: "pen",
    penDrawingNodeId: null,
    pathEditModeNodeId: null,
    selectedIds: [],
    selectedPathPointIds: [],
    nodes: {},
    childOrder: { [ROOT]: [] },
    zoom: 1,
  });
}

describe("penInteraction state helpers", () => {
  it("shows overlay whenever a stroke is in progress", () => {
    assert.equal(shouldShowPenDrawingOverlay(null), false);
    assert.equal(shouldShowPenDrawingOverlay("path-1"), true);
  });

  it("uses placement anchor for segment preview during click-drag", () => {
    assert.deepEqual(
      resolvePenLivePreviewTarget({ x: 10, y: 0 }, { anchor: { x: 5, y: 0 }, drag: { x: 8, y: 2 } }),
      { x: 5, y: 0 },
    );
    assert.deepEqual(resolvePenLivePreviewTarget({ x: 10, y: 0 }, null), { x: 10, y: 0 });
  });

  it("resolves smooth vs corner commit from drag distance", () => {
    const placement = { anchor: { x: 0, y: 0 }, drag: { x: 8, y: 0 } };
    assert.equal(resolvePenPointCommit(placement, 5), "smooth");
    assert.equal(resolvePenPointCommit({ anchor: { x: 0, y: 0 }, drag: { x: 2, y: 0 } }, 5), "corner");
  });

  it("maps escape, enter, and tool switch actions", () => {
    assert.equal(resolvePenEscapeAction(1), "cancel");
    assert.equal(resolvePenEscapeAction(2), "finishOpen");
    assert.equal(resolvePenToolSwitchAction(1), "cancel");
    assert.equal(resolvePenToolSwitchAction(2), "finishOpen");
    assert.equal(shouldPenEnterFinish(1), false);
    assert.equal(shouldPenEnterFinish(2), true);
  });
});

describe("penInteraction drawing flow", () => {
  it("first click starts path and keeps drawing active", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 100, y: 100 });
    const st = useEditorStore.getState();
    assert.ok(st.penDrawingNodeId);
    assert.equal(st.nodes[st.penDrawingNodeId!]?.pathPoints?.length, 1);
    assert.equal(st.nodes[st.penDrawingNodeId!]?.pathPoints?.[0]?.pointType, "corner");
  });

  it("second click creates a straight segment and keeps drawing active", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    const drawId = useEditorStore.getState().penDrawingNodeId!;
    useEditorStore.getState().addPathPoint({ x: 100, y: 0 });
    const st = useEditorStore.getState();
    assert.equal(st.penDrawingNodeId, drawId);
    assert.equal(st.nodes[drawId]?.pathPoints?.length, 2);
    const pts = st.nodes[drawId]?.pathPoints ?? [];
    assert.equal(pts[1]?.pointType, "corner");
    assert.equal(pts[1]?.handleIn, undefined);
    assert.equal(pts[1]?.handleOut, undefined);
  });

  it("click-drag creates a smooth point and keeps drawing active", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    const drawId = useEditorStore.getState().penDrawingNodeId!;
    useEditorStore.getState().addPathPointDrag({ x: 100, y: 0 }, { x: 130, y: 30 });
    const st = useEditorStore.getState();
    assert.equal(st.penDrawingNodeId, drawId);
    const pts = st.nodes[drawId]?.pathPoints ?? [];
    assert.equal(pts.length, 2);
    assert.equal(pts[1]?.pointType, "smooth");
    assert.ok(pts[0]?.handleOut);
    assert.ok(pts[1]?.handleIn);
    assert.ok(pts[1]?.handleOut);
  });

  it("after drag release the next preview anchor is the latest point", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    const drawId = useEditorStore.getState().penDrawingNodeId!;
    useEditorStore.getState().addPathPointDrag({ x: 100, y: 0 }, { x: 130, y: 30 });
    const st = useEditorStore.getState();
    const origin = getRenderedWorldTopLeft(drawId, st.nodes, st.childOrder);
    const prev = penPreviousWorldAnchor(st.nodes[drawId]?.pathPoints ?? [], origin);
    assert.ok(prev);
    assert.equal(prev!.x, 100);
    assert.equal(prev!.y, 0);
  });

  it("close path does not duplicate the first point", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    const drawId = useEditorStore.getState().penDrawingNodeId!;
    useEditorStore.getState().addPathPoint({ x: 100, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 100, y: 80 });
    const origin = getRenderedWorldTopLeft(drawId, useEditorStore.getState().nodes, useEditorStore.getState().childOrder);
    const firstWorld = { x: origin.x, y: origin.y };
    assert.ok(canClosePathAt({ x: firstWorld.x + 4, y: firstWorld.y }, firstWorld, 3, 1));
    useEditorStore.getState().finishPath(true);
    const st = useEditorStore.getState();
    assert.equal(st.penDrawingNodeId, null);
    assert.equal(st.nodes[drawId]?.pathPoints?.length, 3);
    assert.equal(st.nodes[drawId]?.pathClosed, true);
  });

  it("does not close while placing the third anchor near the start", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 100, y: 0 });
    const st = useEditorStore.getState();
    const drawId = st.penDrawingNodeId!;
    const origin = getRenderedWorldTopLeft(drawId, st.nodes, st.childOrder);
    const firstWorld = { x: origin.x, y: origin.y };
    const prev = penPreviousWorldAnchor(st.nodes[drawId]?.pathPoints ?? [], origin);
    const { closePath } = resolvePenClickAnchor(
      { x: firstWorld.x + 3, y: firstWorld.y },
      prev,
      firstWorld,
      2,
      false,
      1,
    );
    assert.equal(closePath, false);
  });

  it("close click resolves before adding another anchor", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 100, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 100, y: 80 });
    const st = useEditorStore.getState();
    const drawId = st.penDrawingNodeId!;
    const origin = getRenderedWorldTopLeft(drawId, st.nodes, st.childOrder);
    const firstWorld = { x: origin.x, y: origin.y };
    const prev = penPreviousWorldAnchor(st.nodes[drawId]?.pathPoints ?? [], origin);
    const { closePath } = resolvePenClickAnchor(
      { x: firstWorld.x + 3, y: firstWorld.y },
      prev,
      firstWorld,
      3,
      false,
      1,
    );
    assert.equal(closePath, true);
  });

  it("escape cancels a one-point stub and finishes a valid open path", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    assert.equal(resolvePenEscapeAction(1), "cancel");
    useEditorStore.getState().cancelPath();
    assert.equal(useEditorStore.getState().penDrawingNodeId, null);

    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 50, y: 0 });
    assert.equal(resolvePenEscapeAction(2), "finishOpen");
    useEditorStore.getState().finishPath(false);
    const st = useEditorStore.getState();
    assert.equal(st.penDrawingNodeId, null);
    assert.equal(st.nodes[Object.keys(st.nodes)[0]!]?.pathClosed, false);
  });

  it("switching tools finishes valid strokes instead of deleting them", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 80, y: 0 });
    const drawId = useEditorStore.getState().penDrawingNodeId!;
    assert.equal(resolvePenToolSwitchAction(2), "finishOpen");
    useEditorStore.getState().setTool("move");
    const st = useEditorStore.getState();
    assert.equal(st.penDrawingNodeId, null);
    assert.ok(st.nodes[drawId]);
    assert.equal(st.selectedIds[0], drawId);
  });

  it("pen tool can enter vector edit on a finished path selection", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 80, y: 0 });
    useEditorStore.getState().finishPath(false);
    const pathId = useEditorStore.getState().selectedIds[0]!;
    const st = useEditorStore.getState();
    assert.equal(st.pathEditModeNodeId, pathId);
    assert.equal(st.penDrawingNodeId, null);

    useEditorStore.getState().setPathEditMode(null);
    useEditorStore.getState().enterVectorEditMode(pathId);
    assert.equal(useEditorStore.getState().pathEditModeNodeId, pathId);
  });

  it("close path stays stroke-only until fill is set manually", () => {
    resetPenStore();
    useEditorStore.getState().startPathAt({ x: 0, y: 0 });
    const drawId = useEditorStore.getState().penDrawingNodeId!;
    useEditorStore.getState().addPathPoint({ x: 100, y: 0 });
    useEditorStore.getState().addPathPoint({ x: 100, y: 100 });
    useEditorStore.getState().finishPath(true);
    const path = useEditorStore.getState().nodes[drawId];
    assert.equal(path?.pathClosed, true);
    assert.equal(path?.fillEnabled, false);
    assert.equal(path?.fill, "transparent");
  });
});

describe("PenDrawSession commit decision", () => {
  it("uses the shared smooth vs corner resolver", () => {
    assert.equal(
      resolvePenPointCommit({ anchor: { x: 100, y: 0 }, drag: { x: 102, y: 0 } }, 5),
      "corner",
    );
    assert.equal(
      resolvePenPointCommit({ anchor: { x: 100, y: 0 }, drag: { x: 120, y: 20 } }, 5),
      "smooth",
    );
  });
});
