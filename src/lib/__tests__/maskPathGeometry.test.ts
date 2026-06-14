import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMaskClipPathDForGroup } from "@/lib/booleanGeometry";
import {
  applyMatrixToPathD,
  maskLocalPathDToGroupLocalPathD,
  shapeNodeToExactPathD,
} from "@/lib/maskPathGeometry";
import { identityMatrix, rotateMatrix, translateMatrix } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

function ellipseMask(id: string, parentId: string, w = 80, h = 80): EditorNode {
  return {
    id,
    parentId,
    type: "ellipse",
    name: id,
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#000",
    fillEnabled: true,
    strokePosition: "center",
  } as EditorNode;
}

function rectMask(
  id: string,
  parentId: string,
  cornerRadius = 0,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    cornerRadius,
    fill: "#000",
    fillEnabled: true,
    strokePosition: "center",
    ...extra,
  } as EditorNode;
}

describe("mask exact path geometry", () => {
  it("ellipse mask uses arc commands (smooth circle)", () => {
    const node = ellipseMask("e", "g");
    const exact = shapeNodeToExactPathD(node);
    assert.ok(exact);
    assert.match(exact!.pathD, /\bA\b/);
    assert.doesNotMatch(exact!.pathD, / L \d+ \d+ L \d+ \d+ L \d+ \d+ L \d+ \d+ L /);
  });

  it("rounded rectangle mask preserves corner curves", () => {
    const node = rectMask("r", "g", 12);
    const exact = shapeNodeToExactPathD(node);
    assert.ok(exact);
    assert.match(exact!.pathD, /\b[ACQ]\b/);
  });

  it("vector path mask preserves bezier curves", () => {
    const node: EditorNode = {
      id: "p",
      parentId: "g",
      type: "path",
      name: "curve",
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      rotation: 0,
      visible: true,
      locked: false,
      pathClosed: true,
      pathPoints: [
        { id: "a", x: 10, y: 70 },
        { id: "b", x: 60, y: 10, handleOut: { x: 20, y: -10 } },
        { id: "c", x: 110, y: 70, handleIn: { x: -20, y: 10 } },
      ],
      fill: "#000",
      fillEnabled: true,
      strokePosition: "center",
    } as EditorNode;
    const exact = shapeNodeToExactPathD(node);
    assert.ok(exact);
    assert.match(exact!.pathD, /\bC\b/);
  });

  it("imported flattened SVG path is used verbatim", () => {
    const d = "M 0 0 C 10 0 20 10 30 10 S 50 0 60 10 L 60 40 L 0 40 Z";
    const node: EditorNode = {
      id: "svg",
      parentId: "g",
      type: "path",
      name: "logo",
      x: 0,
      y: 0,
      width: 60,
      height: 40,
      rotation: 0,
      visible: true,
      locked: false,
      pathClosed: true,
      pathPoints: [],
      flattenedPathData: d,
      fill: "#000",
      fillEnabled: true,
      strokePosition: "center",
    } as EditorNode;
    const exact = shapeNodeToExactPathD(node);
    assert.equal(exact!.pathD, d);
  });

  it("evenodd fill-rule is preserved for multi-contour paths", () => {
    const node: EditorNode = {
      id: "hole",
      parentId: "g",
      type: "path",
      name: "donut",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      visible: true,
      locked: false,
      pathClosed: true,
      pathFillRule: "evenodd",
      flattenedPathData: "M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z",
      pathPoints: [],
      fill: "#000",
      fillEnabled: true,
      strokePosition: "center",
    } as EditorNode;
    const exact = shapeNodeToExactPathD(node);
    assert.equal(exact!.fillRule, "evenodd");
  });

  it("applyMatrixToPathD transforms coordinates", () => {
    const d = "M 0 0 L 10 0 L 10 10 Z";
    const out = applyMatrixToPathD(d, translateMatrix(5, 7));
    assert.ok(out);
    assert.match(out!, /M 5 7/);
    assert.match(out!, /L 15 7/);
  });

  it("buildMaskClipPathDForGroup uses exact ellipse arcs in group-local space", () => {
    const g = "mg";
    const mask = ellipseMask("mask", g, 80, 80);
    const content = rectMask("content", g);
    content.x = 10;
    content.y = 10;
    const group: EditorNode = {
      id: g,
      parentId: null,
      type: "group",
      name: "Mask",
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      rotation: 0,
      visible: true,
      locked: false,
      maskId: "mask",
    } as EditorNode;
    const nodes = { [g]: group, mask, content };
    const childOrder = { [g]: ["content", "mask"] };
    const clip = buildMaskClipPathDForGroup(g, "mask", nodes, childOrder);
    assert.ok(clip);
    // Transformed arcs become cubics; still smooth (not polygonal line chains).
    assert.match(clip!.clipD, /\bC\b/);
    const lineCount = (clip!.clipD.match(/\bL\b/g) ?? []).length;
    assert.ok(lineCount < 4, `expected curve mask, got ${lineCount} L segments`);
    assert.equal(clip!.clipRule, "nonzero");
  });

  it("rotated mask shape transforms clip path into group-local space", () => {
    const g = "mg";
    const mask = ellipseMask("mask", g, 60, 40);
    mask.rotation = 45;
    mask.x = 10;
    mask.y = 5;
    const group: EditorNode = {
      id: g,
      parentId: null,
      type: "group",
      name: "Mask",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      rotation: 0,
      visible: true,
      locked: false,
      maskId: "mask",
    } as EditorNode;
    const nodes = { [g]: group, mask };
    const childOrder = { [g]: ["mask"] };

    const unrotated = buildMaskClipPathDForGroup(g, "mask", {
      ...nodes,
      mask: { ...mask, rotation: 0, x: 0, y: 0 },
    }, childOrder);
    const rotated = buildMaskClipPathDForGroup(g, "mask", nodes, childOrder);
    assert.ok(unrotated && rotated);
    assert.notEqual(rotated!.clipD, unrotated!.clipD);
  });

  it("maskLocalPathDToGroupLocalPathD applies rotation via matrix chain", () => {
    const localD = "M 0 0 L 10 0 L 10 10 Z";
    const maskWorld = multiplyRotateTranslate(10, 5, 45, 30, 20);
    const groupWorld = identityMatrix();
    const out = maskLocalPathDToGroupLocalPathD(localD, maskWorld, groupWorld);
    assert.ok(out);
    assert.doesNotMatch(out!, /^M 0 0 L 10 0/);
  });
});

function multiplyRotateTranslate(
  tx: number,
  ty: number,
  deg: number,
  cx: number,
  cy: number,
) {
  let m = identityMatrix();
  m = {
    a: m.a,
    b: m.b,
    c: m.c,
    d: m.d,
    e: m.e + tx,
    f: m.f + ty,
  };
  const r = rotateMatrix(deg, cx, cy);
  return {
    a: m.a * r.a + m.c * r.b,
    b: m.b * r.a + m.d * r.b,
    c: m.a * r.c + m.c * r.d,
    d: m.b * r.c + m.d * r.d,
    e: m.a * r.e + m.c * r.f + m.e,
    f: m.b * r.e + m.d * r.f + m.f,
  };
}
