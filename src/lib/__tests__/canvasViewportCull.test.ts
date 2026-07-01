import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPinnedSceneIds,
  computeWorldViewportRect,
  filterVisibleSceneTextNodeIds,
  isViewportCullingEnabled,
  rectsIntersect,
  shouldRenderCanvasNode,
  type ViewportCullContext,
} from "@/lib/canvasViewportCull";
import type { EditorNode } from "@/stores/useEditorStore";

describe("canvasViewportCull", () => {
  it("computeWorldViewportRect maps screen viewport to world space", () => {
    const rect = computeWorldViewportRect(1000, 800, { x: 100, y: 50 }, 2, 0);
    assert.equal(rect.x, -50);
    assert.equal(rect.y, -25);
    assert.equal(rect.width, 500);
    assert.equal(rect.height, 400);
  });

  it("rectsIntersect detects overlap", () => {
    assert.equal(
      rectsIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 },
      ),
      true,
    );
    assert.equal(
      rectsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 },
      ),
      false,
    );
  });

  it("buildPinnedSceneIds includes ancestors of selected nodes", () => {
    const nodes: Record<string, EditorNode> = {
      frame: { id: "frame", type: "frame", parentId: null, x: 0, y: 0, width: 400, height: 400, visible: true, locked: false, name: "F", rotation: 0, expanded: true },
      child: { id: "child", type: "rectangle", parentId: "frame", x: 10, y: 10, width: 40, height: 40, visible: true, locked: false, name: "C", rotation: 0, expanded: true },
    };
    const childOrder = { frame: ["child"] };
    const pinned = buildPinnedSceneIds({
      selectedIds: ["child"],
      hoveredId: null,
      objectEditModeNodeId: null,
      pathEditModeNodeId: null,
      editingTextId: null,
      penDrawingNodeId: null,
      pencilDrawingNodeId: null,
      shapeDrawingNodeId: null,
      frameDrawingNodeId: null,
      textDrawingNodeId: null,
      placingComponentMasterId: null,
      dragMovingIds: [],
      nodes,
      childOrder,
    });
    assert.equal(pinned.has("child"), true);
    assert.equal(pinned.has("frame"), true);
  });

  it("shouldRenderCanvasNode keeps pinned nodes outside viewport", () => {
    const nodes: Record<string, EditorNode> = {
      off: { id: "off", type: "rectangle", parentId: null, x: 5000, y: 5000, width: 40, height: 40, visible: true, locked: false, name: "Off", rotation: 0, expanded: true },
    };
    const childOrder = { __root__: ["off"] };
    const ctx = {
      enabled: true,
      worldViewport: { x: 0, y: 0, width: 1000, height: 800 },
      pinnedIds: new Set<string>(),
    };
    assert.equal(shouldRenderCanvasNode("off", nodes, childOrder, ctx), false);
    ctx.pinnedIds = new Set(["off"]);
    assert.equal(shouldRenderCanvasNode("off", nodes, childOrder, ctx), true);
  });

  it("isViewportCullingEnabled defaults to true", () => {
    assert.equal(isViewportCullingEnabled(), true);
  });

  it("filterVisibleSceneTextNodeIds keeps only text in the viewport", () => {
    const nodes: Record<string, EditorNode> = {
      on: {
        id: "on",
        type: "text",
        parentId: null,
        x: 100,
        y: 100,
        width: 80,
        height: 20,
        visible: true,
        locked: false,
        name: "on",
        rotation: 0,
        content: "visible",
      },
      off: {
        id: "off",
        type: "text",
        parentId: null,
        x: 5000,
        y: 5000,
        width: 80,
        height: 20,
        visible: true,
        locked: false,
        name: "off",
        rotation: 0,
        content: "hidden",
      },
    };
    const childOrder = { root: ["on", "off"] };
    const ctx: ViewportCullContext = {
      enabled: true,
      worldViewport: { x: 0, y: 0, width: 800, height: 600 },
      pinnedIds: new Set(),
    };
    const visible = filterVisibleSceneTextNodeIds(["on", "off"], nodes, childOrder, ctx);
    assert.deepEqual(visible, ["on"]);
  });
});
