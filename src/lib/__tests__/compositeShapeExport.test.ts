import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  booleanGroupExportStyle,
  clipPathCssFromPathD,
  codeExportChildIds,
  maskGroupExportStyle,
} from "@/lib/codeExport/compositeShapeExport";
import { nodeToHtml } from "@/lib/codeExport/htmlExport";
import { nodeToJsx } from "@/lib/codeRoundTrip/reactExport";

function shape(
  id: string,
  type: EditorNode["type"],
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId: "g1",
    type,
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    locked: false,
    fill: "#1e00ff",
    fillEnabled: true,
    ...extra,
  };
}

describe("compositeShapeExport", () => {
  it("omits boolean operands and mask layer from exported children", () => {
    const nodes: Record<string, EditorNode> = {
      g1: shape("g1", "group", { isBooleanGroup: true, booleanOperation: "subtract", parentId: null }),
      a: shape("a", "ellipse", { x: 0, y: 0 }),
      b: shape("b", "ellipse", { x: 20, y: 10 }),
    };
    const childOrder = { g1: ["a", "b"] };
    assert.deepEqual(codeExportChildIds(nodes.g1!, childOrder), []);

    const mask: Record<string, EditorNode> = {
      mg: shape("mg", "group", { maskId: "mask", parentId: null }),
      mask: shape("mask", "ellipse"),
      content: shape("content", "rectangle", { x: 10, y: 10, width: 50, height: 50 }),
    };
    const maskOrder = { mg: ["content", "mask"] };
    assert.deepEqual(codeExportChildIds(mask.mg!, maskOrder), ["content"]);
  });

  it("exports subtract boolean as inline SVG with Clipper2 path", () => {
    const nodes: Record<string, EditorNode> = {
      sub: shape("sub", "group", {
        parentId: null,
        isBooleanGroup: true,
        booleanOperation: "subtract",
        width: 120,
        height: 120,
      }),
      base: shape("base", "ellipse", { x: 0, y: 0, width: 100, height: 100 }),
      hole: shape("hole", "ellipse", { x: 30, y: 0, width: 80, height: 80 }),
    };
    const childOrder = { sub: ["base", "hole"] };
    const style = booleanGroupExportStyle(nodes.sub!, nodes, childOrder);
    assert.equal(style.background, "transparent");
    assert.equal(style.clipPath, undefined);

    const html = nodeToHtml(nodes.sub!, nodes, childOrder, {}, 0);
    assert.match(html, /<path d="/);
    assert.doesNotMatch(html, /<mask[^>]*>/);
    assert.doesNotMatch(html, /data-pc-id="base"/);
    assert.doesNotMatch(html, /data-pc-id="hole"/);

    const jsx = nodeToJsx(nodes.sub!, nodes, childOrder, {}, 0, { portable: true });
    assert.match(jsx, /<path/);
    assert.doesNotMatch(jsx, /<mask/);
  });

  it("exports mask group with clip-path and content only", () => {
    const nodes: Record<string, EditorNode> = {
      mg: shape("mg", "group", { parentId: null, maskId: "mask", width: 80, height: 80 }),
      mask: shape("mask", "ellipse", { x: 0, y: 0, width: 80, height: 80 }),
      content: shape("content", "rectangle", {
        x: 10,
        y: 10,
        width: 120,
        height: 120,
        fill: "#ff0000",
      }),
    };
    const childOrder = { mg: ["content", "mask"] };
    const style = maskGroupExportStyle(nodes.mg!, nodes, childOrder);
    assert.equal(style.clipPath, undefined);
    assert.equal(style.overflow, "hidden");

    const html = nodeToHtml(nodes.mg!, nodes, childOrder, {}, 0);
    assert.match(html, /clipPath id="pc-mask-export-clip-/);
    assert.match(html, /clip-path:\s*url\(#pc-mask-export-clip-/);
    assert.match(html, /data-pc-id="content"/);
    assert.doesNotMatch(html, /data-pc-id="mask"/);
  });

  it("clipPathCssFromPathD supports evenodd", () => {
    assert.match(clipPathCssFromPathD("M 0 0 L 10 0 Z", "evenodd"), /evenodd/);
  });

  it("exports union as single Clipper2 composite path", () => {
    const nodes: Record<string, EditorNode> = {
      u: shape("u", "group", {
        parentId: null,
        isBooleanGroup: true,
        booleanOperation: "union",
        width: 140,
        height: 140,
      }),
      a: shape("a", "ellipse", { x: 0, y: 0, width: 80, height: 80 }),
      b: shape("b", "ellipse", { x: 40, y: 40, width: 80, height: 80 }),
    };
    const childOrder = { u: ["a", "b"] };
    const html = nodeToHtml(nodes.u!, nodes, childOrder, {}, 0);
    const pathCount = (html.match(/<path /g) ?? []).length;
    assert.equal(pathCount, 1);
    assert.match(html, /<path d="/);
  });

  it("exports intersect as single Clipper2 composite path", () => {
    const nodes: Record<string, EditorNode> = {
      ix: shape("ix", "group", {
        parentId: null,
        isBooleanGroup: true,
        booleanOperation: "intersect",
        width: 100,
        height: 100,
      }),
      a: shape("a", "ellipse", { x: 0, y: 0, width: 100, height: 100 }),
      b: shape("b", "ellipse", { x: 30, y: 0, width: 100, height: 100 }),
    };
    const childOrder = { ix: ["a", "b"] };
    const html = nodeToHtml(nodes.ix!, nodes, childOrder, {}, 0);
    assert.match(html, /<path d="/);
    assert.doesNotMatch(html, /<clipPath[^>]*>/);
  });

  it("exports exclude as single Clipper2 composite path", () => {
    const nodes: Record<string, EditorNode> = {
      ex: shape("ex", "group", {
        parentId: null,
        isBooleanGroup: true,
        booleanOperation: "exclude",
        width: 120,
        height: 120,
      }),
      a: shape("a", "ellipse", { x: 0, y: 0, width: 100, height: 100 }),
      b: shape("b", "ellipse", { x: 40, y: 20, width: 80, height: 80 }),
    };
    const childOrder = { ex: ["a", "b"] };
    const html = nodeToHtml(nodes.ex!, nodes, childOrder, {}, 0);
    assert.match(html, /<path d="/);
    assert.doesNotMatch(html, /<mask[^>]*>/);
  });
});
