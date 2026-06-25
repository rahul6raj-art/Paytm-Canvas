import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { pathToSvgD } from "@/lib/pathGeometry";
import { buildResizeContentPatches, pathContentPatchFromBoxResize, scaleSubtreeContentPatches } from "@/lib/resizeContent";
import { fullEllipseBezierPathPoints } from "@/lib/shapes/ellipseArc";
import { lineEndpointsPatchFromBoxResize, layoutFromLineEndpoints } from "@/lib/shapes/lineGeometry";
import { polygonPathPoints } from "@/lib/shapes/polygonGeometry";
import { generateStarPoints } from "@/lib/shapes/pathGenerators";

function rectNode(overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "r1",
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    cornerRadius: 16,
    ...overrides,
  };
}

describe("resizeContent corner radius", () => {
  it("preserves corner radius on proportional resize", () => {
    const node = rectNode();
    const patch = buildResizeContentPatches(
      node,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 200 },
      "se",
      { shiftKey: true, altKey: true },
    );
    assert.equal(patch.cornerRadius, undefined);
    assert.equal(patch.cornerRadii, undefined);
  });

  it("preserves child corner radius when frame scales proportionally", () => {
    const parent = rectNode({ id: "frame", type: "frame", cornerRadius: 0 });
    const child = rectNode({ id: "child", parentId: "frame", cornerRadius: 12 });
    const nodes = { frame: parent, child };
    const patches = scaleSubtreeContentPatches("frame", nodes, { frame: ["child"] }, 2, 2, 2);
    assert.equal(patches.child?.cornerRadius, undefined);
    assert.equal(patches.child?.cornerRadii, undefined);
  });

  it("scales corner radius on non-proportional corner resize", () => {
    const node = rectNode({ cornerRadius: 20 });
    const patch = buildResizeContentPatches(
      node,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 50, height: 50 },
      "se",
      { shiftKey: false, altKey: false },
    );
    assert.equal(patch.cornerRadius, 10);
  });
});

describe("resizeContent polygon", () => {
  it("regenerates pathPoints when polygon bounds shrink", () => {
    const node: EditorNode = {
      ...rectNode({ type: "polygon", polygonSides: 6, width: 100, height: 100 }),
      pathPoints: polygonPathPoints(6, 100, 100),
    };
    const patch = buildResizeContentPatches(
      node,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 25, y: 25, width: 50, height: 50 },
      "nw",
      { shiftKey: true, altKey: true },
    );
    assert.equal(patch.pathPoints?.length, 6);
    const xs = patch.pathPoints!.map((p) => p.x);
    const ys = patch.pathPoints!.map((p) => p.y);
    assert.ok(Math.max(...xs) <= 50);
    assert.ok(Math.max(...ys) <= 50);
    assert.ok(Math.min(...xs) >= 0);
    assert.ok(Math.min(...ys) >= 0);
  });
});

describe("resizeContent star", () => {
  it("regenerates pathPoints when star bounds shrink", () => {
    const node: EditorNode = {
      ...rectNode({ type: "path", width: 100, height: 100 }),
      pathPoints: generateStarPoints(5, 0.4, 100, 100),
      starPoints: 5,
      starInnerRadius: 0.4,
      pathClosed: true,
    };
    const patch = buildResizeContentPatches(
      node,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 50, height: 50 },
      "se",
      { shiftKey: true, altKey: true },
    );
    assert.equal(patch.pathPoints?.length, 10);
    const xs = patch.pathPoints!.map((p) => p.x);
    const ys = patch.pathPoints!.map((p) => p.y);
    assert.ok(Math.max(...xs) <= 50);
    assert.ok(Math.max(...ys) <= 50);
  });
});

describe("resizeContent text", () => {
  it("scales fontSize from drag-start across live resize frames", () => {
    const node = rectNode({ type: "text", fontSize: 16, width: 100, height: 40, content: "Hi" });
    const start = { x: 0, y: 0, width: 100, height: 100 };
    const patch1 = buildResizeContentPatches(
      node,
      start,
      { x: 0, y: 0, width: 80, height: 80 },
      "se",
      { shiftKey: true, altKey: true },
      { startFontSize: 16 },
    );
    const after1 = { ...node, ...patch1, width: 80, height: 80 };
    const patch2 = buildResizeContentPatches(
      after1,
      start,
      { x: 0, y: 0, width: 50, height: 50 },
      "se",
      { shiftKey: true, altKey: true },
      { startFontSize: 16 },
    );
    assert.equal(patch2.fontSize, 8);
  });
});

describe("resizeContent frame children", () => {
  it("scales nested path geometry from drag-start across live resize frames", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 50, y: 100 },
    ];
    const frame = rectNode({ id: "frame", type: "frame", width: 200, height: 200, cornerRadius: 0 });
    const child: EditorNode = {
      ...rectNode({
        id: "child",
        parentId: "frame",
        type: "path",
        width: 100,
        height: 100,
        x: 10,
        y: 10,
      }),
      pathPoints: points,
      pathClosed: true,
    };
    const startNodes = { frame, child };
    const nodesAfterFrame1 = {
      frame,
      child: {
        ...child,
        width: 80,
        height: 80,
        x: 8,
        y: 8,
        pathPoints: points.map((p) => ({ ...p, x: p.x * 0.8, y: p.y * 0.8 })),
      },
    };
    const patches = scaleSubtreeContentPatches(
      "frame",
      nodesAfterFrame1,
      { frame: ["child"] },
      0.5,
      0.5,
      0.5,
      startNodes,
    );
    assert.equal(patches.child?.width, 50);
    assert.equal(patches.child?.x, 5);
    const corner = patches.child?.pathPoints?.find((p) => p.id === "b");
    assert.equal(corner?.x, 50);
  });
});

describe("resizeContent line", () => {
  it("keeps endpoints aligned with the resized line box", () => {
    const line = layoutFromLineEndpoints(0, 50, 200, 50, 2);
    const shrunk = { ...line, width: line.width * 0.5 };
    const ep = lineEndpointsPatchFromBoxResize(line, shrunk);
    assert.ok(Math.abs(ep.lineX2! - ep.lineX1! - shrunk.width) < 1);
  });
});

describe("resizeContent pen path", () => {
  it("scales path points when the node box width shrinks", () => {
    const points = [
      { id: "a", x: 0, y: 5 },
      { id: "b", x: 200, y: 5 },
    ];
    const patch = pathContentPatchFromBoxResize(
      { type: "path", width: 200, height: 10, pathPoints: points },
      100,
      10,
    );
    assert.equal(patch.pathPoints?.find((p) => p.id === "b")?.x, 100);
    assert.equal(patch.pathPoints?.find((p) => p.id === "a")?.x, 0);
  });

  it("scales flattened path data when the node box shrinks", () => {
    const patch = pathContentPatchFromBoxResize(
      {
        type: "path",
        width: 200,
        height: 100,
        pathPoints: [],
        flattenedPathData: "M 0 0 L 200 0 L 200 100 Z",
      },
      100,
      50,
    );
    assert.match(patch.flattenedPathData ?? "", /L 100 0/);
    assert.match(patch.flattenedPathData ?? "", /L 100 50/);
  });

  it("scales from drag-start anchors across live resize frames", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 200, y: 0 },
    ];
    const node: EditorNode = {
      ...rectNode({ type: "path", pathClosed: false, width: 200, height: 20 }),
      pathPoints: points,
    };
    const start = { x: 0, y: 0, width: 200, height: 20 };
    const patch1 = buildResizeContentPatches(
      node,
      start,
      { x: 0, y: 0, width: 160, height: 20 },
      "e",
      { shiftKey: false, altKey: false },
      { startPathPoints: points },
    );
    const after1 = { ...node, ...patch1, width: 160, height: 20 };
    const patch2 = buildResizeContentPatches(
      after1,
      start,
      { x: 0, y: 0, width: 100, height: 20 },
      "e",
      { shiftKey: false, altKey: false },
      { startPathPoints: points },
    );
    assert.equal(patch2.pathPoints?.find((p) => p.id === "b")?.x, 100);
  });
});

describe("resizeContent path handles", () => {
  it("scales pathPoints from drag-start anchors across live resize frames", () => {
    const points = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 50, y: 100 },
    ];
    const node: EditorNode = {
      ...rectNode({ type: "path", pathClosed: true, width: 100, height: 100 }),
      pathPoints: points,
    };
    const start = { x: 0, y: 0, width: 100, height: 100 };
    const patch1 = buildResizeContentPatches(
      node,
      start,
      { x: 0, y: 0, width: 80, height: 80 },
      "se",
      { shiftKey: false, altKey: false },
      { startPathPoints: points },
    );
    const after1 = { ...node, ...patch1, width: 80, height: 80 };
    const patch2 = buildResizeContentPatches(
      after1,
      start,
      { x: 0, y: 0, width: 50, height: 50 },
      "se",
      { shiftKey: false, altKey: false },
      { startPathPoints: points },
    );
    const corner = patch2.pathPoints?.find((p) => p.id === "b");
    assert.equal(corner?.x, 50);
    assert.equal(corner?.y, 0);
  });

  it("scales Bézier handle vectors with the path frame", () => {
    const points = fullEllipseBezierPathPoints(100, 100);
    const node: EditorNode = {
      ...rectNode({ type: "path", pathClosed: true, pathPoints: points }),
    };
    const patch = buildResizeContentPatches(
      node,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 100 },
      "e",
      { shiftKey: false, altKey: false },
    );
    const top = patch.pathPoints?.find((p) => p.y === 0);
    assert.ok(top?.handleOut);
    assert.ok(Math.abs(top.handleOut.x) > 50, "horizontal handle should scale with width");
    const before = pathToSvgD(points, true);
    const after = pathToSvgD(patch.pathPoints!, true);
    assert.notEqual(after, before);
  });
});
