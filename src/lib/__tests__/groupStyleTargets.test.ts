import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAlignTargetIds, canAlignSelection } from "@/lib/alignSelection";
import {
  collectContainerStyleTargets,
  containerSupportsAggregateFillStroke,
  expandStyleTargetIds,
  nodeHasOwnBackgroundFill,
  pickPrimaryFillStyleTarget,
  resolveFillStrokeStyleContext,
} from "@/lib/groupStyleTargets";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

function path(id: string, parentId: string | null): EditorNode {
  return {
    id,
    parentId,
    type: "path",
    name: "Vector",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#ffffff",
    fillEnabled: true,
  } as EditorNode;
}

describe("groupStyleTargets", () => {
  it("detects outlined text groups as aggregate fill/stroke containers", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Rahul",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        fillEnabled: false,
      } as EditorNode,
      r: path("r", "g"),
      a: path("a", "g"),
    };
    const childOrder = { g: ["r", "a"] };
    assert.equal(containerSupportsAggregateFillStroke(nodes.g!, nodes, childOrder), true);
    assert.deepEqual(
      collectContainerStyleTargets("g", nodes, childOrder).map((n) => n.id),
      ["r", "a"],
    );
    assert.deepEqual(expandStyleTargetIds("g", nodes, childOrder), ["r", "a"]);
  });

  it("keeps card frame fill on the frame instead of first text child", () => {
    const pageCss = `.pml-more-theme-card { background: var(--surface-level-4); }`;
    const tokens: Record<string, DesignToken> = {
      "css-var-surface-level-4": {
        id: "css-var-surface-level-4",
        name: "surface-level-4",
        type: "color",
        value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const nodes: Record<string, EditorNode> = {
      card: {
        id: "card",
        parentId: null,
        type: "frame",
        name: "Dark theme",
        x: 0,
        y: 0,
        width: 320,
        height: 72,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#f5f5f5",
        fillEnabled: true,
        codeClassName: "pml-more-theme-card",
      } as EditorNode,
      label: {
        id: "label",
        parentId: "card",
        type: "text",
        name: "Label",
        x: 16,
        y: 16,
        width: 120,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Dark theme",
        textColor: "#282828",
        fillEnabled: true,
      } as EditorNode,
    };
    const childOrder = { card: ["label"] };
    assert.equal(
      nodeHasOwnBackgroundFill(nodes.card!, tokens, [pageCss]),
      true,
    );
    const ctx = resolveFillStrokeStyleContext(
      nodes.card!,
      nodes,
      childOrder,
      tokens,
      [pageCss],
    );
    assert.equal(ctx.styleNode.id, "card");
    assert.deepEqual(ctx.aggregateStyleTargets, []);
    assert.deepEqual(expandStyleTargetIds("card", nodes, childOrder), ["card"]);
  });

  it("picks background rect inside a fill-less list row", () => {
    const nodes: Record<string, EditorNode> = {
      row: {
        id: "row",
        parentId: null,
        type: "frame",
        name: "List row",
        x: 0,
        y: 0,
        width: 320,
        height: 56,
        rotation: 0,
        visible: true,
        locked: false,
        fillEnabled: false,
      } as EditorNode,
      bg: {
        id: "bg",
        parentId: "row",
        type: "rectangle",
        name: "Background",
        x: 0,
        y: 0,
        width: 320,
        height: 56,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#ffffff",
        fillEnabled: true,
        codeClassName: "surface-level-4",
      } as EditorNode,
      label: {
        id: "label",
        parentId: "row",
        type: "text",
        name: "Label",
        x: 16,
        y: 16,
        width: 120,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Start onboarding",
        textColor: "#282828",
        fillEnabled: true,
      } as EditorNode,
    };
    const childOrder = { row: ["label", "bg"] };
    const primary = pickPrimaryFillStyleTarget(nodes.row!, nodes, childOrder);
    assert.equal(primary.id, "bg");
    const ctx = resolveFillStrokeStyleContext(nodes.row!, nodes, childOrder);
    assert.equal(ctx.styleNode.id, "bg");
    assert.deepEqual(ctx.aggregateStyleTargets.map((n) => n.id), ["bg"]);
  });

  it("keeps auto-layout frame fill on the frame instead of the first child", () => {
    const nodes: Record<string, EditorNode> = {
      al: {
        id: "al",
        parentId: null,
        type: "frame",
        name: "Rectangle 1",
        x: 0,
        y: 0,
        width: 408,
        height: 269,
        rotation: 0,
        visible: true,
        locked: false,
        fillEnabled: false,
        layoutMode: "horizontal",
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      } as EditorNode,
      child: {
        id: "child",
        parentId: "al",
        type: "rectangle",
        name: "Rectangle 1",
        x: 0,
        y: 0,
        width: 408,
        height: 269,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#cfcfcf",
        fillEnabled: true,
      } as EditorNode,
    };
    const childOrder = { al: ["child"] };
    const ctx = resolveFillStrokeStyleContext(nodes.al!, nodes, childOrder);
    assert.equal(ctx.styleNode.id, "al");
    assert.deepEqual(ctx.aggregateStyleTargets, []);
    assert.deepEqual(expandStyleTargetIds("al", nodes, childOrder), ["al"]);
  });
});

describe("resolveAlignTargetIds", () => {
  it("aligns children when a text outline group is selected", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Rahul",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
      } as EditorNode,
      r: path("r", "g"),
      a: path("a", "g"),
    };
    const childOrder = { g: ["r", "a"] };
    assert.deepEqual(resolveAlignTargetIds(["g"], nodes, childOrder), ["r", "a"]);
    assert.equal(canAlignSelection(["g"], nodes, childOrder), true);
  });
});
