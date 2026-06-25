import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newPathPointId, normalizePathNode, pathBounds } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

describe("pathGeometry normalize", () => {
  it("pathBounds can exclude Bézier handles", () => {
    const points = [
      {
        id: newPathPointId(),
        x: 50,
        y: 0,
        handleIn: { x: 0, y: -40 },
        handleOut: { x: 0, y: 40 },
      },
    ];
    const withHandles = pathBounds(points);
    const anchorsOnly = pathBounds(points, { includeHandles: false });
    assert.equal(withHandles.y, -40);
    assert.equal(anchorsOnly.y, 0);
    assert.equal(anchorsOnly.height, 0);
  });

  it("normalizePathNode keeps zero height for horizontal pen strokes", () => {
    const node: EditorNode = {
      id: "line-path",
      parentId: null,
      type: "path",
      name: "Vector",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      pathClosed: false,
      pathPoints: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 0 },
      ],
    };
    const normalized = normalizePathNode(node);
    assert.equal(normalized.width, 120);
    assert.equal(normalized.height, 0);
    assert.equal(normalized.pathPoints?.[0]?.y, 0);
    assert.equal(normalized.pathPoints?.[1]?.x, 120);
  });

  it("flattenNearAxisPathPoints collapses sub-pixel vertical drift", () => {
    const node: EditorNode = {
      id: "line-path",
      parentId: null,
      type: "path",
      name: "Vector",
      x: 0,
      y: 0,
      width: 80,
      height: 1,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      pathClosed: false,
      pathPoints: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 80, y: 0.7 },
      ],
    };
    const normalized = normalizePathNode(node);
    assert.equal(normalized.height, 0);
    assert.equal(normalized.pathPoints?.[1]?.y, 0);
  });

  it("normalizePathNode does not rebase when only handles extend outside anchors", () => {
    const basePoints = [
      { id: "top", x: 50, y: 0, handleIn: { x: -20, y: 0 }, handleOut: { x: 20, y: 0 } },
      { id: "right", x: 100, y: 50, handleIn: { x: 0, y: -20 }, handleOut: { x: 0, y: 20 } },
      { id: "bottom", x: 50, y: 100, handleIn: { x: 20, y: 0 }, handleOut: { x: -20, y: 0 } },
      { id: "left", x: 0, y: 50, handleIn: { x: 0, y: 20 }, handleOut: { x: 0, y: -20 } },
    ];
    const node: EditorNode = {
      id: "p1",
      parentId: null,
      type: "path",
      name: "Path",
      x: 100,
      y: 200,
      width: 100,
      height: 100,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      pathClosed: true,
      pathPoints: basePoints,
    };
    const stretched: EditorNode = {
      ...node,
      pathPoints: basePoints.map((p) =>
        p.id === "top" ? { ...p, handleIn: { x: 0, y: -80 }, handleOut: { x: 0, y: 80 } } : p,
      ),
    };
    const normalized = normalizePathNode(stretched);
    assert.equal(normalized.x, 100);
    assert.equal(normalized.y, 200);
    assert.equal(normalized.pathPoints?.find((p) => p.id === "top")?.x, 50);
    assert.equal(normalized.pathPoints?.find((p) => p.id === "top")?.y, 0);
    assert.equal(normalized.pathPoints?.find((p) => p.id === "top")?.handleIn?.y, -80);
  });
});
