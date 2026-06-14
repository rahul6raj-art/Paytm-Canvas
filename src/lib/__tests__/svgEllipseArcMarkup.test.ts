import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSceneRenderNode, svgRectLike } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

function ellipseNode(patch: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "e1",
    type: "ellipse",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    fill: "#18a0fb",
    fillEnabled: true,
    ...patch,
  } as EditorNode;
}

describe("svgRectLike ellipse arc", () => {
  it("uses a path when sweep is less than a full circle", () => {
    const markup = svgRectLike(ellipseNode({ arcSweepDeg: 90 }));
    assert.match(markup, /<path d="/);
    assert.doesNotMatch(markup, /<ellipse /);
  });

  it("uses a path with evenodd fill when inner ratio creates a ring", () => {
    const markup = svgRectLike(ellipseNode({ arcInnerRadiusRatio: 0.4 }));
    assert.match(markup, /<path d="/);
    assert.match(markup, /fill-rule="evenodd"/);
  });

  it("keeps a native ellipse for a full pie with no inner hole", () => {
    const markup = svgRectLike(ellipseNode());
    assert.match(markup, /<ellipse /);
    assert.doesNotMatch(markup, /<path d="/);
  });

  it("applies instance arc overrides when resolving scene render node", () => {
    const instRoot = "inst-1";
    const ellipseId = "e1";
    const nodes: Record<string, EditorNode> = {
      [instRoot]: {
        id: instRoot,
        type: "frame",
        parentId: null,
        sourceComponentId: "cmp-1",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        instanceOverrides: { [ellipseId]: { arcSweepDeg: 90 } },
      } as EditorNode,
      [ellipseId]: ellipseNode({ id: ellipseId, parentId: instRoot }),
    };
    const renderNode = resolveSceneRenderNode(nodes[ellipseId]!, nodes, {});
    const markup = svgRectLike(renderNode);
    assert.match(markup, /<path d="/);
    assert.doesNotMatch(markup, /<ellipse /);
  });
});
