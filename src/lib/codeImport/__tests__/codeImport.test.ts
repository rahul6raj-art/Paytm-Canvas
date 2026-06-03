import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { exportSelectionCode } from "@/lib/codeExport/selectionCodeExport";
import { importCodeSource } from "@/lib/codeImport";

function frame(id: string, name: string, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    fillEnabled: true,
  };
}

function text(id: string, parentId: string, content: string): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: "Label",
    x: 8,
    y: 8,
    width: 80,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    fill: "#111111",
    fillEnabled: true,
    fontSize: 14,
  };
}

function rect(id: string, parentId: string | null, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: "Box",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#3b82f6",
    fillEnabled: true,
    cornerRadius: 8,
  };
}

function ellipse(id: string, parentId: string | null, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId,
    type: "ellipse",
    name: "Circle",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ef4444",
    fillEnabled: true,
  };
}

describe("code import", () => {
  it("exports frame at code origin without canvas x/y", () => {
    const f = frame("f1", "Screen", 120, 200, 300, 400);
    const r = rect("r1", "f1", 24, 32, 80, 40);
    const nodes = { f1: f, r1: r };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["r1"] };

    const exported = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["r1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    assert.match(exported.code, /data-pc-root="f1"/);
    assert.match(exported.code, /data-pc-type="frame"/);
    assert.doesNotMatch(exported.code, /left:\s*120px/);
    assert.doesNotMatch(exported.code, /top:\s*200px/);
    assert.match(exported.code, /left:\s*24px/);
    assert.match(exported.code, /top:\s*32px/);
  });

  it("preserves rectangle vs ellipse types in HTML round-trip", () => {
    const f = frame("f1", "Screen", 0, 0, 300, 200);
    const r = rect("r1", "f1", 20, 30, 80, 40);
    const e = ellipse("e1", "f1", 120, 30, 60, 60);
    const nodes = { f1: f, r1: r, e1: e };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["r1", "e1"] };

    const exported = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    assert.match(exported.code, /data-pc-type="rectangle"/);
    assert.match(exported.code, /data-pc-type="ellipse"/);

    const imported = importCodeSource(exported.code, "html");
    assert.equal(imported.ok, true);
    if (!imported.ok) return;

    const rectNode = imported.slice.nodes.r1;
    const ellipseNode = imported.slice.nodes.e1;
    assert.equal(rectNode?.type, "rectangle");
    assert.equal(ellipseNode?.type, "ellipse");
    assert.notEqual(rectNode?.type, "ellipse");
  });

  it("exports ellipse arc pie with clip-path and round-trips arc attrs", () => {
    const f = frame("f1", "Screen", 0, 0, 200, 200);
    const e: EditorNode = {
      ...ellipse("e1", "f1", 10, 10, 75, 75),
      arcStartDeg: 0,
      arcSweepDeg: 270,
      arcInnerRadiusRatio: 0.32,
    };
    const nodes = { f1: f, e1: e };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["e1"] };

    const exported = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["e1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    assert.match(exported.code, /clip-path:\s*path\(/);
    assert.match(exported.code, /data-pc-arc-sweep="270"/);
    assert.match(exported.code, /data-pc-arc-ratio="0.32"/);

    const imported = importCodeSource(exported.code, "html");
    assert.equal(imported.ok, true);
    if (!imported.ok) return;

    const back = imported.slice.nodes.e1;
    assert.equal(back?.type, "ellipse");
    assert.ok(Math.abs((back?.arcSweepDeg ?? 0) - 270) < 0.01);
    assert.ok(Math.abs((back?.arcInnerRadiusRatio ?? 0) - 0.32) < 0.01);
  });

  it("round-trips HTML export to canvas layers", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    const t = text("t1", "f1", "Hello");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };

    const exported = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    const imported = importCodeSource(exported.code, "html");
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.ok(imported.slice.nodes.f1 || Object.values(imported.slice.nodes).some((n) => n.name === "Card"));
    const textNode = Object.values(imported.slice.nodes).find((n) => n.content === "Hello");
    assert.ok(textNode);
  });

  it("round-trips portable React export to canvas layers", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    f.codeJsxTag = "Header";
    f.codeJsxIntrinsic = false;
    const t = text("t1", "f1", "Hi");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };

    const exported = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "react",
    });

    const imported = importCodeSource(exported.code, "react");
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const header = Object.values(imported.slice.nodes).find((n) => n.codeJsxTag === "Header");
    assert.ok(header);
    assert.ok(Object.values(imported.slice.nodes).some((n) => n.content === "Hi"));
  });
});
