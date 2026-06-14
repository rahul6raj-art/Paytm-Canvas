import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMaskClipPathDForGroup } from "@/lib/booleanGeometry";
import {
  isMaskGroup,
  maskGroupContentChildIds,
  maskGroupExportDefs,
  maskFieldsFromNode,
  applyMaskFieldsToNode,
  renderMaskGroupSvg,
  resolveMaskCompositorMode,
  shapeNodeToExactPathD,
} from "@/lib/mask";
import { isLocalPointInsideMaskPath } from "@/lib/mask/maskHitTesting";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { defaultNodeEffect } from "@/lib/nodeEffects";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, parentId: string, x: number, y: number, w: number, h: number, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#3366ff",
    fillEnabled: true,
    strokePosition: "center",
    ...extra,
  } as EditorNode;
}

function ellipse(id: string, parentId: string, x: number, y: number, w: number, h: number, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    ...rect(id, parentId, x, y, w, h),
    type: "ellipse",
    ...extra,
  } as EditorNode;
}

function maskGroupScene(overrides: {
  group?: Partial<EditorNode>;
  mask?: Partial<EditorNode>;
  content?: Partial<EditorNode>;
} = {}) {
  const g = "mg";
  const mask = {
    ...ellipse("mask", g, 10, 10, 80, 80),
    ...overrides.mask,
  } as EditorNode;
  if (overrides.mask?.type === "rectangle") {
    Object.assign(mask, { type: "rectangle" });
  }
  const content = {
    ...rect("content", g, 0, 0, 120, 120, { fill: "#ff0000" }),
    ...overrides.content,
  } as EditorNode;
  const group: EditorNode = {
    id: g,
    parentId: null,
    type: "group",
    name: "Mask group",
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    rotation: 0,
    visible: true,
    locked: false,
    maskId: "mask",
    figMaskType: "OUTLINE",
    maskVisible: false,
    ...overrides.group,
  } as EditorNode;
  const nodes = { [g]: group, mask, content };
  const childOrder = { [g]: ["content", "mask"] };
  return { g, nodes, childOrder, mask, content, group };
}

describe("Figma-like mask compositor", () => {
  it("rectangle mask over content uses outline clip", () => {
    const { g, nodes, childOrder } = maskGroupScene({
      mask: { x: 20, y: 20, width: 60, height: 60, type: "rectangle" },
      content: { width: 100, height: 100 },
    });
    const clip = buildMaskClipPathDForGroup(g, "mask", nodes, childOrder);
    assert.ok(clip);
    assert.match(clip!.clipD, /M.*Z/);
  });

  it("circle mask uses exact arcs in clip path", () => {
    const { g, nodes, childOrder } = maskGroupScene();
    const clip = buildMaskClipPathDForGroup(g, "mask", nodes, childOrder);
    assert.ok(clip);
    assert.match(clip!.clipD, /\bC\b/);
  });

  it("outline mode selected for solid vector mask", () => {
    const { nodes, g } = maskGroupScene();
    const group = nodes[g]!;
    const mask = nodes.mask!;
    assert.equal(resolveMaskCompositorMode(group, mask), "OUTLINE");
  });

  it("alpha mode selected for semi-transparent mask", () => {
    const { nodes, g } = maskGroupScene({ mask: { fillOpacity: 0.5 } });
    const group = nodes[g]!;
    const mask = nodes.mask!;
    assert.equal(resolveMaskCompositorMode(group, mask), "ALPHA");
  });

  it("luminance mode respected when explicitly set", () => {
    const { nodes, g } = maskGroupScene({ group: { figMaskType: "LUMINANCE" } });
    assert.equal(resolveMaskCompositorMode(nodes[g]!, nodes.mask!), "LUMINANCE");
  });

  it("renderMaskGroupSvg emits clipPath defs not CSS", () => {
    const { g, nodes, childOrder } = maskGroupScene();
    const defs: string[] = [];
    const result = renderMaskGroupSvg({
      groupId: g,
      node: nodes[g]!,
      nodes,
      childOrder,
      registerDef: (m) => defs.push(m),
      renderChild: () => `<rect width="10" height="10"/>`,
    });
    assert.ok(result);
    assert.equal(result!.mode, "OUTLINE");
    assert.match(defs.join(""), /<clipPath/);
    assert.match(result!.bodyMarkup, /clip-path="url\(#/);
    assert.doesNotMatch(result!.bodyMarkup, /clipPath:\s*url/);
  });

  it("renderMaskGroupSvg uses SVG mask for luminance mode", () => {
    const { g, nodes, childOrder } = maskGroupScene({ group: { figMaskType: "LUMINANCE" } });
    const defs: string[] = [];
    const result = renderMaskGroupSvg({
      groupId: g,
      node: nodes[g]!,
      nodes,
      childOrder,
      registerDef: (m) => defs.push(m),
      renderChild: () => `<rect width="10" height="10"/>`,
    });
    assert.ok(result);
    assert.equal(result!.mode, "LUMINANCE");
    assert.match(defs.join(""), /<mask/);
    assert.match(result!.bodyMarkup, /mask="url\(#/);
  });

  it("mask layer omitted from content by default", () => {
    const { g, nodes, childOrder } = maskGroupScene();
    const contentIds = maskGroupContentChildIds(g, childOrder[g]!, nodes);
    assert.deepEqual(contentIds, ["content"]);
    assert.ok(isMaskGroup(nodes[g]));
  });

  it("svg scene renders mask group with clipPath", () => {
    const { g, nodes, childOrder } = maskGroupScene();
    const scene = buildSvgScene({ rootIds: [g], nodes, childOrder });
    assert.match(scene.defs, /clipPath/);
    assert.match(scene.body, /clip-path="url\(#/);
    assert.doesNotMatch(scene.body, /data-pc-id="mask"/);
  });

  it("svg scene applies layer effects to masked composite", () => {
    const { g, nodes, childOrder } = maskGroupScene({
      group: {
        effects: [{ ...defaultNodeEffect("drop-shadow"), visible: true }],
      },
    });
    const scene = buildSvgScene({ rootIds: [g], nodes, childOrder });
    assert.match(scene.body, /filter="url\(#pc-filter-mg\)"/);
    assert.match(scene.defs, /<filter id="pc-filter-mg"/);
  });

  it("hit test rejects points outside circular mask", () => {
    const { g, nodes, childOrder } = maskGroupScene();
    assert.equal(
      isLocalPointInsideMaskPath(50, 50, g, "mask", nodes, childOrder),
      true,
    );
    assert.equal(
      isLocalPointInsideMaskPath(0, 0, g, "mask", nodes, childOrder),
      false,
    );
  });

  it("rounded rectangle mask preserves curves", () => {
    const g = "mg";
    const mask = rect("mask", g, 0, 0, 100, 60, { cornerRadius: 12 });
    const exact = shapeNodeToExactPathD(mask);
    assert.ok(exact);
    assert.match(exact!.pathD, /\b[AC]\b/);
  });

  it("star mask preserves vector path", () => {
    const g = "mg";
    const mask: EditorNode = {
      id: "mask",
      parentId: g,
      type: "path",
      name: "star",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      visible: true,
      locked: false,
      starPoints: 5,
      starInnerRadius: 0.4,
      fill: "#000",
      fillEnabled: true,
      strokePosition: "center",
    } as EditorNode;
    const exact = shapeNodeToExactPathD(mask);
    assert.ok(exact?.pathD.includes("M"));
  });

  it("evenodd holes preserved in clip path", () => {
    const g = "mg";
    const mask: EditorNode = {
      id: "mask",
      parentId: g,
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
      flattenedPathData:
        "M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z",
      pathPoints: [],
      fill: "#000",
      fillEnabled: true,
      strokePosition: "center",
    } as EditorNode;
    const group = { ...maskGroupScene().nodes.mg!, maskId: "mask" };
    const nodes = { mg: group, mask };
    const clip = buildMaskClipPathDForGroup("mg", "mask", nodes, { mg: ["mask"] });
    assert.equal(clip!.clipRule, "evenodd");
    assert.match(clip!.clipD, /M.*Z.*M.*Z/);
    assert.equal(isLocalPointInsideMaskPath(50, 50, "mg", "mask", nodes, { mg: ["mask"] }), false);
    assert.equal(isLocalPointInsideMaskPath(10, 10, "mg", "mask", nodes, { mg: ["mask"] }), true);
  });

  it("rotated mask group transforms clip path", () => {
    const { g, nodes, childOrder } = maskGroupScene({ mask: { rotation: 30, x: 5, y: 5 } });
    const clip = buildMaskClipPathDForGroup(g, "mask", nodes, childOrder);
    const unrotated = buildMaskClipPathDForGroup(g, "mask", {
      ...nodes,
      mask: { ...nodes.mask!, rotation: 0, x: 10, y: 10 },
    }, childOrder);
    assert.ok(clip && unrotated);
    assert.notEqual(clip!.clipD, unrotated!.clipD);
  });

  it("scaled mask group still produces clip path", () => {
    const { g, nodes, childOrder } = maskGroupScene({
      group: { width: 240, height: 240 },
      mask: { width: 160, height: 160 },
    });
    const clip = buildMaskClipPathDForGroup(g, "mask", nodes, childOrder);
    assert.ok(clip);
    assert.match(clip!.clipD, /\bC\b/);
  });

  it("nested mask group renders without error", () => {
    const inner = maskGroupScene();
    const outerG = "outer";
    const outer: EditorNode = {
      ...inner.group,
      id: outerG,
      parentId: null,
      maskId: "outerMask",
    };
    const outerMask = ellipse("outerMask", outerG, 0, 0, 100, 100);
    inner.group.parentId = outerG;
    inner.mask.parentId = inner.g;
    inner.content.parentId = inner.g;
    const nodes = {
      [outerG]: outer,
      [inner.g]: { ...inner.group, parentId: outerG, x: 10, y: 10 },
      [inner.mask.id]: inner.mask,
      [inner.content.id]: inner.content,
      outerMask,
    };
    const childOrder = {
      [outerG]: [inner.g, "outerMask"],
      [inner.g]: ["content", "mask"],
    };
    const scene = buildSvgScene({ rootIds: [outerG], nodes, childOrder });
    assert.match(scene.defs, /clipPath|mask/);
  });

  it("mask serialization round-trips figMaskType and maskVisible", () => {
    const { group, nodes, childOrder, g } = maskGroupScene({
      group: { figMaskType: "ALPHA", maskVisible: true },
    });
    const persisted = maskFieldsFromNode(group, childOrder[g]!);
    assert.deepEqual(persisted, {
      type: "group",
      maskId: "mask",
      figMaskType: "ALPHA",
      maskVisible: true,
      children: ["content", "mask"],
    });
    const restored = applyMaskFieldsToNode(nodes[g]!, persisted!);
    assert.equal(restored.figMaskType, "ALPHA");
    assert.equal(restored.maskVisible, true);
  });

  it("SVG export uses clipPath for outline masks", () => {
    const { group, nodes, childOrder } = maskGroupScene();
    const exp = maskGroupExportDefs(group, nodes, childOrder);
    assert.ok(exp);
    assert.equal(exp!.usesSvgMask, false);
    assert.match(exp!.defsMarkup, /<clipPath/);
  });

  it("SVG export uses mask element for luminance mode", () => {
    const { group, nodes, childOrder } = maskGroupScene({ group: { figMaskType: "LUMINANCE" } });
    const exp = maskGroupExportDefs(group, nodes, childOrder);
    assert.ok(exp);
    assert.equal(exp!.usesSvgMask, true);
    assert.match(exp!.defsMarkup, /<mask/);
  });
});
