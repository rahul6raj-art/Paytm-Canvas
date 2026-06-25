import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertNodeToPath,
  cornerRadiiStylePatch,
  ensureRoundedRectPathPoints,
  isCornerRoundablePath,
  isFourCornerClosedPath,
  isRoundedRectPath,
  isVectorEditableShape,
  needsVectorPathConversion,
  pathHasCurveHandles,
  pathNodeUsesFillHit,
  pathOutlineD,
  pathPointCornerIndex,
  pathSupportsCornerRadius,
  resolvePathOutlineD,
  shapeToPathPoints,
  vectorShapeHitOutlineD,
} from "@/lib/shapes/shapeToPath";
import { newPathPointId } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

function baseNode(overrides: Partial<EditorNode>): EditorNode {
  return {
    id: "n1",
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    ...overrides,
  };
}

describe("shapeToPath", () => {
  it("detects vector-editable shapes", () => {
    assert.equal(isVectorEditableShape(baseNode({ type: "rectangle" })), true);
    assert.equal(isVectorEditableShape(baseNode({ type: "text" })), false);
    assert.equal(isVectorEditableShape(baseNode({ locked: true })), false);
  });

  it("converts rectangle to four corner anchors", () => {
    const built = shapeToPathPoints(baseNode({ type: "rectangle", cornerRadius: 8 }));
    assert.equal(built?.pathClosed, true);
    assert.equal(built?.pathPoints.length, 4);
  });

  it("renders rounded rect path from corner radii", () => {
    const pathNode = convertNodeToPath(baseNode({ type: "rectangle", cornerRadius: 12 }));
    assert.ok(pathNode);
    assert.equal(isRoundedRectPath(pathNode!), true);
    const d = pathOutlineD(pathNode!);
    assert.ok(d.includes("A "), "rounded rect outline uses arc commands for radius");
  });

  it("converts line to open two-point path", () => {
    const built = shapeToPathPoints(baseNode({ type: "line", height: 4 }));
    assert.equal(built?.pathClosed, false);
    assert.equal(built?.pathPoints.length, 2);
  });

  it("convertNodeToPath changes ellipse to four smooth bezier anchors", () => {
    const next = convertNodeToPath(baseNode({ type: "ellipse", width: 80, height: 80 }));
    assert.equal(next?.type, "path");
    assert.equal(next?.pathPoints?.length, 4);
    assert.equal(pathHasCurveHandles(next?.pathPoints), true);
    assert.equal(next?.pathPoints?.every((p) => p.pointType === "smooth"), true);
    const d = pathOutlineD(next!);
    assert.ok(d.includes(" C "), "ellipse outline uses cubic beziers");
  });

  it("ensureRoundedRectPathPoints does not collapse ellipse to rectangle corners", () => {
    const ellipsePath = convertNodeToPath(baseNode({ type: "ellipse", width: 80, height: 80 }));
    assert.ok(ellipsePath);
    assert.equal(ellipsePath!.pathPoints?.length, 4);
    const normalized = ensureRoundedRectPathPoints(ellipsePath!);
    assert.equal(normalized.pathPoints?.length, 4);
    assert.equal(isRoundedRectPath(normalized), false);
  });

  it("convertNodeToPath flattens star and polygon parametric shapes", () => {
    const star = convertNodeToPath(
      baseNode({
        type: "path",
        width: 100,
        height: 100,
        pathClosed: true,
        starPoints: 5,
        starInnerRadius: 0.4,
        pathPoints: [{ id: newPathPointId(), x: 0, y: 0 }],
      }),
    );
    assert.equal(star?.type, "path");
    assert.equal(star?.starPoints, undefined);
    assert.equal(star?.pathPoints?.length, 10);

    const polygon = convertNodeToPath(
      baseNode({ type: "polygon", width: 100, height: 100, polygonSides: 6 }),
    );
    assert.equal(polygon?.type, "path");
    assert.equal(polygon?.polygonSides, undefined);
    assert.equal(polygon?.pathPoints?.length, 6);

    const triangle = convertNodeToPath(
      baseNode({ type: "polygon", width: 100, height: 100, polygonSides: 3 }),
    );
    assert.equal(triangle?.pathPoints?.length, 3);
  });

  it("needsVectorPathConversion covers parametric star, polygon, and triangle", () => {
    assert.equal(
      needsVectorPathConversion(
        baseNode({ type: "path", starPoints: 5, pathPoints: [{ id: "a", x: 0, y: 0 }] }),
      ),
      true,
    );
    assert.equal(needsVectorPathConversion(baseNode({ type: "polygon", polygonSides: 6 })), true);
    assert.equal(needsVectorPathConversion(baseNode({ type: "polygon", polygonSides: 3 })), true);
    assert.equal(
      needsVectorPathConversion(
        baseNode({
          type: "path",
          pathClosed: true,
          pathPoints: [
            { id: "a", x: 0, y: 0 },
            { id: "b", x: 10, y: 0 },
            { id: "c", x: 5, y: 8 },
          ],
        }),
      ),
      false,
    );
  });

  it("detects rect-like paths with bezier handles and out-of-order corners", () => {
    const tl = newPathPointId();
    const tr = newPathPointId();
    const br = newPathPointId();
    const bl = newPathPointId();
    const node = baseNode({
      type: "path",
      width: 100,
      height: 80,
      pathClosed: true,
      pathPoints: [
        { id: br, x: 100, y: 80 },
        { id: tl, x: 0, y: 0, handleOut: { x: 8, y: 0 }, handleIn: { x: 0, y: 8 } },
        { id: bl, x: 0, y: 80 },
        { id: tr, x: 100, y: 0 },
      ],
    });
    assert.equal(isRoundedRectPath(node), true);
    assert.equal(pathPointCornerIndex(node, tr), 1);
    assert.equal(pathPointCornerIndex(node, tl), 0);
  });

  it("supports four-corner closed paths for corner radius", () => {
    const p0 = newPathPointId();
    const p1 = newPathPointId();
    const p2 = newPathPointId();
    const p3 = newPathPointId();
    const node = baseNode({
      type: "path",
      width: 100,
      height: 80,
      pathClosed: true,
      cornerRadius: 6,
      pathPoints: [
        { id: p0, x: 0, y: 0 },
        { id: p1, x: 50, y: 0 },
        { id: p2, x: 100, y: 80 },
        { id: p3, x: 0, y: 80 },
      ],
    });
    assert.equal(isRoundedRectPath(node), false);
    assert.equal(isFourCornerClosedPath(node), true);
    assert.equal(pathSupportsCornerRadius(node), true);
    assert.equal(pathPointCornerIndex(node, p1), 1);
    const d = pathOutlineD(node);
    assert.ok(d.includes(" A "), "quad outline uses circular fillets for radius");
  });

  it("rounds corners on a closed triangle path", () => {
    const p0 = newPathPointId();
    const p1 = newPathPointId();
    const p2 = newPathPointId();
    const node = baseNode({
      type: "path",
      width: 100,
      height: 100,
      pathClosed: true,
      cornerRadii: [0, 0, 20, 0],
      pathPoints: [
        { id: p0, x: 50, y: 0 },
        { id: p1, x: 100, y: 100 },
        { id: p2, x: 0, y: 100 },
      ],
    });
    assert.equal(isCornerRoundablePath(node), true);
    assert.equal(pathSupportsCornerRadius(node), true);
    assert.equal(pathPointCornerIndex(node, p2), 2);
    const d = pathOutlineD(node);
    assert.ok(d.includes(" A "), "triangle outline uses circular fillets for radius");
  });

  it("uses fill hit for open paths with a visible fill", () => {
    const node = baseNode({
      type: "path",
      pathClosed: false,
      fillEnabled: true,
      fill: "#ff0000",
      pathPoints: [
        { id: newPathPointId(), x: 0, y: 0 },
        { id: newPathPointId(), x: 100, y: 0 },
        { id: newPathPointId(), x: 50, y: 80 },
      ],
    });
    assert.equal(pathNodeUsesFillHit(node), true);
    const d = vectorShapeHitOutlineD(node);
    assert.match(d, /z\s*$/i);
  });

  it("keeps stroke-only hit for open paths without fill", () => {
    const node = baseNode({
      type: "path",
      pathClosed: false,
      fillEnabled: false,
      pathPoints: [
        { id: newPathPointId(), x: 0, y: 0 },
        { id: newPathPointId(), x: 100, y: 50 },
      ],
    });
    assert.equal(pathNodeUsesFillHit(node), false);
    const d = vectorShapeHitOutlineD(node);
    assert.doesNotMatch(d, /z\s*$/i);
  });

  it("cornerRadiiStylePatch handles rectangle per-corner radii", () => {
    const node = baseNode({ type: "rectangle", width: 100, height: 80, cornerRadius: 8 });
    const uniform = cornerRadiiStylePatch(node, [8, 8, 8, 8]);
    assert.equal(uniform.cornerRadius, 8);
    assert.equal(uniform.cornerRadii, undefined);

    const unlinked = cornerRadiiStylePatch(node, [4, 8, 12, 0]);
    assert.equal(unlinked.cornerRadius, undefined);
    assert.deepEqual(unlinked.cornerRadii, [4, 8, 12, 0]);
  });

  it("prefers flattenedPathData over editable path points for imported paths", () => {
    const node = baseNode({
      type: "path",
      pathClosed: true,
      flattenedPathData: "M 0 0 L 10 0 L 10 10 L 0 10 Z M 3 3 L 7 3 L 7 7 L 3 7 Z",
      pathPoints: [
        { id: newPathPointId(), x: 0, y: 0 },
        { id: newPathPointId(), x: 10, y: 0 },
        { id: newPathPointId(), x: 10, y: 10 },
        { id: newPathPointId(), x: 0, y: 10 },
      ],
    });
    const d = resolvePathOutlineD(node);
    assert.match(d, /M 3 3/);
    assert.equal((d.match(/ Z/g) ?? []).length, 2);
  });
});
