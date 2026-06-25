import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { pathPointHandleAffordances } from "@/lib/pathEditAnchors";
import { togglePathPointType } from "@/lib/penTool";
import type { PathPoint } from "@/lib/pathGeometry";
import {
  applyPathEditHitSelection,
  applyPathPointHitOnPath,
  hitTestPathAtWorld,
  resolvePathEditTargetNodeId,
  selectedPathPointIdFromHit,
} from "@/lib/pathEditSelection";
import { relativeHandleFromPointer } from "@/lib/vector/pathHandleDrag";
import { mergePathPointHandles } from "@/lib/pathHandles";
import { effectiveHandleMirroring } from "@/lib/penTool/handleMirror";
import { pathToSvgD } from "@/lib/pathGeometry";

const PATH_ID = "path-1";

function makePathNode(points: PathPoint[]): EditorNode {
  return {
    id: PATH_ID,
    type: "path",
    name: "Path",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    visible: true,
    locked: false,
    pathPoints: points,
    pathClosed: false,
  } as EditorNode;
}

function resetStore(points: PathPoint[], opts?: { pathEditModeNodeId?: string | null }) {
  useEditorStore.setState({
    editorMode: "design",
    tool: "pen",
    penDrawingNodeId: null,
    pathEditModeNodeId: opts?.pathEditModeNodeId ?? PATH_ID,
    selectedIds: [PATH_ID],
    selectedPathPointIds: [],
    nodes: { [PATH_ID]: makePathNode(points) },
    childOrder: { [ROOT]: [PATH_ID] },
    zoom: 1,
  });
}

describe("path edit anchor selection", () => {
  const points: PathPoint[] = [
    { id: "a", x: 20, y: 20, pointType: "smooth", handleOut: { x: 30, y: 0 } },
    { id: "b", x: 120, y: 20, pointType: "smooth", handleIn: { x: -30, y: 0 } },
    { id: "c", x: 180, y: 60, pointType: "corner" },
  ];

  it("resolves path edit target from edit mode or single selected path", () => {
    resetStore(points);
    const st = useEditorStore.getState();
    assert.equal(resolvePathEditTargetNodeId(st), PATH_ID);
    useEditorStore.setState({ pathEditModeNodeId: null, selectedIds: [PATH_ID] });
    assert.equal(resolvePathEditTargetNodeId(useEditorStore.getState()), PATH_ID);
    useEditorStore.setState({ selectedIds: [] });
    assert.equal(resolvePathEditTargetNodeId(useEditorStore.getState()), null);
  });

  it("clicking an anchor sets selectedPathPointIds", () => {
    resetStore(points);
    const st = useEditorStore.getState();
    const consumed = applyPathPointHitOnPath(PATH_ID, 20, 20, st, {
      setPathEditMode: (id) => useEditorStore.getState().setPathEditMode(id),
      setSelectedPathPointIds: (ids) => useEditorStore.getState().setSelectedPathPointIds(ids),
      select: (id) => useEditorStore.getState().select(id, false),
    });
    assert.equal(consumed, true);
    assert.deepEqual(useEditorStore.getState().selectedPathPointIds, ["a"]);
  });

  it("pen canvas hit on selected path does not require a new stroke", () => {
    resetStore(points, { pathEditModeNodeId: null });
    const st = useEditorStore.getState();
    const consumed = applyPathEditHitSelection(120, 20, st, {
      setPathEditMode: (id) => useEditorStore.getState().setPathEditMode(id),
      setSelectedPathPointIds: (ids) => useEditorStore.getState().setSelectedPathPointIds(ids),
      select: (id) => useEditorStore.getState().select(id, false),
    });
    assert.equal(consumed, true);
    assert.equal(useEditorStore.getState().penDrawingNodeId, null);
    assert.deepEqual(useEditorStore.getState().selectedPathPointIds, ["b"]);
  });

  it("setPathEditMode on the same path preserves selectedPathPointIds", () => {
    resetStore(points);
    useEditorStore.getState().setSelectedPathPointIds(["a"]);
    useEditorStore.getState().setPathEditMode(PATH_ID);
    assert.deepEqual(useEditorStore.getState().selectedPathPointIds, ["a"]);
  });

  it("selected smooth point with handles exposes handle affordances after draw", () => {
    const pt = points[0]!;
    const affordances = pathPointHandleAffordances(pt, true);
    assert.equal(affordances.length, 2);
    assert.deepEqual(affordances.find((a) => a.kind === "handle-out")?.vec, { x: 30, y: 0 });
  });

  it("double-click corner toggle creates smooth handles", () => {
    const corner = points[2]!;
    const patch = togglePathPointType(corner, 20);
    assert.equal(patch.pointType, "smooth");
    assert.ok(patch.handleIn);
    assert.ok(patch.handleOut);
    const affordances = pathPointHandleAffordances({ ...corner, ...patch } as PathPoint, true);
    assert.equal(affordances.filter((a) => !a.virtual).length, 2);
  });

  it("dragging a visible handle updates rendered path d", () => {
    resetStore(points);
    const pt = points[0]!;
    const before = pathToSvgD(points, false);
    const relative = relativeHandleFromPointer({ x: pt.x, y: pt.y }, { x: 80, y: 40 });
    const mirroring = effectiveHandleMirroring(pt, "none", false);
    const merged = mergePathPointHandles(pt, { handleOut: relative }, mirroring, "out");
    const next = [merged, points[1]!, points[2]!];
    const after = pathToSvgD(next, false);
    assert.notEqual(after, before);
    assert.match(after, /C 80 40/);
  });

  it("hitTestPathAtWorld prioritizes handles over anchors", () => {
    resetStore(points);
    const st = useEditorStore.getState();
    const handleHit = hitTestPathAtWorld(PATH_ID, 50, 20, st);
    assert.equal(handleHit?.kind, "out-handle");
    assert.equal(selectedPathPointIdFromHit(handleHit!), "a");
  });
});
