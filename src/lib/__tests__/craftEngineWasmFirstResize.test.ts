import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

function baseRect(
  id: string,
  opts: { x?: number; y?: number; width?: number; height?: number; parentId?: string | null } = {},
) {
  return {
    id,
    parentId: opts.parentId ?? null,
    type: "rectangle" as const,
    name: "Rect",
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 80,
    height: opts.height ?? 60,
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

describe("craftEngineWasmFirstResize", () => {
  it("resizeNode east handle widens rectangle", () => {
    const id = `rect-r-${Date.now()}`;
    const start = { x: 100, y: 80, width: 200, height: 100 };
    useEditorStore.setState({
      nodes: { [id]: baseRect(id, start) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().resizeNode(
      id,
      "e",
      start,
      { x: 250, y: 130 },
      { shiftKey: false, altKey: false },
      { skipHistory: true },
    );
    const n = useEditorStore.getState().nodes[id];
    assert.equal(n?.width, 250);
    assert.equal(n?.x, 100);
    assert.equal(n?.y, 80);
  });

  it("resizeFrameWithConstraints stretches left-right constrained child", () => {
    const fid = `frame-r-${Date.now()}`;
    const cid = `child-r-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [fid]: {
          id: fid,
          parentId: null,
          type: "frame",
          name: "Frame",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
        [cid]: {
          ...baseRect(cid, { parentId: fid, x: 10, y: 10, width: 30, height: 30 }),
          constraintsHorizontal: "left-right" as const,
          constraintsVertical: "top" as const,
        },
      },
      childOrder: { [ROOT]: [fid], [fid]: [cid] },
    });
    useEditorStore.getState().resizeFrameWithConstraints(
      fid,
      { width: 200, height: 100 },
      { skipHistory: true },
    );
    const frame = useEditorStore.getState().nodes[fid];
    const child = useEditorStore.getState().nodes[cid];
    assert.equal(frame?.width, 200);
    assert.equal(child?.width, 130);
    assert.equal(child?.x, 10);
  });
});
