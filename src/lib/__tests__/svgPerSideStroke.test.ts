import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { svgPerSideStrokeMarkup, shouldRenderSvgPerSideStroke } from "@/lib/svgPerSideStroke";
import { svgRectLike } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

function rectNode(
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id: "r1",
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#cccccc",
    fillEnabled: true,
    strokeColor: "#111111",
    strokeWidth: 4,
    strokeEnabled: true,
    strokePosition: "center",
    strokeStyle: "solid",
    strokeSides: "all",
    ...extra,
  } as EditorNode;
}

const SIDE_PRESETS = ["top", "bottom", "left", "right"] as const;
const POSITIONS = ["inside", "center", "outside"] as const;

const STROKE_RGBA = "rgba(17,17,17,1)";

describe("svgPerSideStroke", () => {
  it("detects per-side stroke modes", () => {
    assert.equal(shouldRenderSvgPerSideStroke(rectNode({ strokeSides: "all" })), false);
    assert.equal(shouldRenderSvgPerSideStroke(rectNode({ strokeSides: "top" })), true);
    assert.equal(
      shouldRenderSvgPerSideStroke(
        rectNode({
          strokeSides: "custom",
          strokeSidesCustom: { top: 4, right: 0, bottom: 0, left: 0 },
        }),
      ),
      true,
    );
  });

  for (const side of SIDE_PRESETS) {
    for (const position of POSITIONS) {
      it(`sharp rect: ${side} stroke at ${position}`, () => {
        const node = rectNode({ strokeSides: side, strokePosition: position });
        const markup = svgRectLike(node, { nodeId: node.id });
        assert.match(markup, /fill="#cccccc"/);
        assert.doesNotMatch(markup, /stroke-width="4"/, "full outline stroke should be omitted");
        assert.ok(
          markup.includes(`fill="${STROKE_RGBA}"`) || markup.includes('stroke="#111111"'),
          `expected stroke color band for ${side}/${position}`,
        );
      });
    }
  }

  it("custom top+right on sharp rect renders two bands", () => {
    const node = rectNode({
      strokeSides: "custom",
      strokeSidesCustom: { top: 6, right: 3, bottom: 0, left: 0 },
      strokePosition: "inside",
    });
    const markup = svgPerSideStrokeMarkup(node, {
      nodeId: node.id,
      width: 100,
      height: 60,
      clipPathD: "M 0 0 H 100 V 60 H 0 Z",
      strokeColor: "#111111",
      strokeAttrs: "",
    });
    assert.ok(markup);
    assert.equal((markup!.match(/<rect /g) ?? []).length, 2);
  });

  it("custom different widths on sharp rect", () => {
    const node = rectNode({
      strokeSides: "custom",
      strokeSidesCustom: { top: 8, right: 2, bottom: 4, left: 6 },
      strokePosition: "center",
    });
    const markup = svgPerSideStrokeMarkup(node, {
      nodeId: node.id,
      width: 100,
      height: 60,
      clipPathD: "",
      strokeColor: "#111111",
      strokeAttrs: "",
    });
    assert.ok(markup);
    assert.equal((markup!.match(/<rect /g) ?? []).length, 4);
    assert.match(markup!, /height="8"/);
    assert.match(markup!, /width="2"/);
  });

  it("rounded rect partial top uses filled border geometry", () => {
    const node = rectNode({
      cornerRadius: 16,
      strokeSides: "top",
      strokePosition: "outside",
    });
    const markup = svgRectLike(node, { nodeId: node.id });
    assert.match(markup, /fill="#cccccc"/);
    assert.doesNotMatch(markup, /stroke-width="4"/);
    assert.ok(markup.includes(`fill="${STROKE_RGBA}"`));
    assert.doesNotMatch(markup, /stroke="#111111"/);
  });

  it("custom per-side colors render different fills", () => {
    const node = rectNode({
      strokeSides: "custom",
      strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
      strokeSidesCustomColors: { top: "#ff0000", right: "#0000ff" },
      strokePosition: "inside",
    });
    const markup = svgPerSideStrokeMarkup(node, {
      nodeId: node.id,
      width: 100,
      height: 60,
      clipPathD: "M 0 0 H 100 V 60 H 0 Z",
      strokeColor: "#111111",
      strokeAttrs: "",
    });
    assert.ok(markup);
    assert.match(markup!, /fill="rgba\(255,0,0,1\)"/);
    assert.match(markup!, /fill="rgba\(0,0,255,1\)"/);
  });

  it("center all-sides gradient stroke uses outline fill with gradient url", () => {
    const defs: string[] = [];
    const node = rectNode({
      strokeType: "gradient",
      strokeGradient: {
        kind: "linear",
        stops: [
          { id: "s1", color: "#ff0000", position: 0 },
          { id: "s2", color: "#0000ff", position: 100 },
        ],
        transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 0 },
        handles: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 1, y: 0 },
        ],
      },
      strokePosition: "center",
    });
    const markup = svgRectLike(node, {
      nodeId: node.id,
      registerGradient: (id, m) => defs.push(m),
    });
    assert.match(markup, /fill="url\(#pc-grad-pc-sg-r1\)"/);
    assert.doesNotMatch(markup, /stroke="#111111"/);
    assert.doesNotMatch(markup, /stroke-width="4"/);
    assert.ok(defs.some((d) => d.includes('id="pc-grad-pc-sg-r1"')));
  });

  it("gradient per-side stroke registers paint and uses filled bands", () => {
    const node = rectNode({
      strokeSides: "custom",
      strokeSidesCustom: { top: 4, right: 0, bottom: 0, left: 0 },
      strokeType: "gradient",
      strokeGradient: {
        kind: "linear",
        stops: [
          { id: "s1", color: "#ff0000", position: 0 },
          { id: "s2", color: "#0000ff", position: 100 },
        ],
        transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 0 },
        handles: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 1, y: 0 },
        ],
      },
      cornerRadius: 16,
      strokePosition: "inside",
    });
    assert.equal(shouldRenderSvgPerSideStroke(node), true);
    const markup = svgPerSideStrokeMarkup(node, {
      nodeId: node.id,
      width: 100,
      height: 60,
      clipPathD: "M 0 0 H 100 V 60 H 0 Z",
      strokeColor: "#111111",
      strokeAttrs: "",
    });
    assert.ok(markup);
    assert.match(markup!, /<linearGradient/);
    assert.match(markup!, /fill="url\(#/);
    assert.doesNotMatch(markup!, /fill="rgba\(17,17,17,1\)"/);
  });

  it("rounded rect top+right custom at inside uses filled paths", () => {
    const node = rectNode({
      cornerRadius: 16,
      strokeSides: "custom",
      strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
      strokePosition: "inside",
    });
    const markup = svgRectLike(node, { nodeId: node.id });
    const strokePaths = markup.match(/<path[^>]*fill="rgba\(17,17,17,1\)"[^>]*>/g) ?? [];
    assert.equal(strokePaths.length, 2, "two filled border paths");
    assert.doesNotMatch(markup, /stroke-width="4"/);
    assert.doesNotMatch(markup, /stroke="#111111"/);
    assert.doesNotMatch(markup, /<rect[^>]*fill="rgba\(17,17,17,1\)"/);
  });

  it("rounded top+right custom colors render correct side paints", () => {
    const node = rectNode({
      cornerRadius: 21,
      width: 63,
      height: 76,
      strokeSides: "custom",
      strokeSidesCustom: { top: 1, right: 1, bottom: 0, left: 0 },
      strokeSidesCustomColors: { top: "#ff0000", right: "#ffffff" },
      strokePosition: "center",
      fill: "#CFCFCF",
    });
    const markup = svgRectLike(node, { nodeId: node.id });
    assert.match(markup, /fill="rgba\(255,0,0,1\)"/);
    assert.match(markup, /fill="rgba\(255,255,255,1\)"/);
    assert.doesNotMatch(markup, /stroke-width="1"/);
    const redPaths = markup.match(/<path[^>]*fill="rgba\(255,0,0,1\)"[^>]*>/g) ?? [];
    const whitePaths = markup.match(/<path[^>]*fill="rgba\(255,255,255,1\)"[^>]*>/g) ?? [];
    assert.equal(redPaths.length, 1, "one red top border path");
    assert.equal(whitePaths.length, 1, "one white right border path");
    const redD = redPaths[0]!.match(/d="([^"]+)"/)?.[1] ?? "";
    const whiteD = whitePaths[0]!.match(/d="([^"]+)"/)?.[1] ?? "";
    assert.ok(redD.includes("L 21"), "red path should include top straight edge start");
    assert.ok(redD.includes("L 42") || redD.includes("42"), "red path should span top edge");
    assert.ok(whiteD.includes("63.5") || whiteD.includes("63"), "white path should include right edge");
  });

  it("top+bottom rounded custom colors assign corners correctly", () => {
    const node = rectNode({
      cornerRadius: 21,
      width: 63,
      height: 76,
      strokeSides: "custom",
      strokeSidesCustom: { top: 1, right: 0, bottom: 1, left: 0 },
      strokeSidesCustomColors: { top: "#ff0000", bottom: "#0000ff" },
      strokePosition: "center",
    });
    const markup = svgRectLike(node, { nodeId: node.id });
    assert.match(markup, /fill="rgba\(255,0,0,1\)"/);
    assert.match(markup, /fill="rgba\(0,0,255,1\)"/);
    const redD =
      markup.match(/<path[^>]*\bd="([^"]+)"[^>]*fill="rgba\(255,0,0,1\)"/)?.[1] ??
      markup.match(/<path[^>]*fill="rgba\(255,0,0,1\)"[^>]*\bd="([^"]+)"/)?.[1] ??
      "";
    const blueD =
      markup.match(/<path[^>]*\bd="([^"]+)"[^>]*fill="rgba\(0,0,255,1\)"/)?.[1] ??
      markup.match(/<path[^>]*fill="rgba\(0,0,255,1\)"[^>]*\bd="([^"]+)"/)?.[1] ??
      "";
    assert.ok(redD.length > 20, "top border path should be substantial");
    assert.ok(blueD.length > 20, "bottom border path should be substantial");
  });

  it("buildSvgScene renders per-side stroke in scene body", () => {
    const id = "rect-1";
    const nodes: Record<string, EditorNode> = {
      [id]: rectNode({
        id,
        strokeSides: "left",
        strokePosition: "inside",
      }),
    };
    const scene = buildSvgScene({
      rootIds: [id],
      nodes,
      childOrder: { __root__: [id] },
    });
    assert.ok(scene.body.includes(`fill="${STROKE_RGBA}"`));
    assert.doesNotMatch(scene.body, /stroke-width="4"/);
  });
});
