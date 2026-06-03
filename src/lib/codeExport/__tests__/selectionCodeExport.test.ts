import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { exportSelectionCode } from "../selectionCodeExport";

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

describe("exportSelectionCode", () => {
  it("exports full HTML document with data-pc-id", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    const t = text("t1", "f1", "Hello");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };

    const out = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    assert.match(out.code, /<!DOCTYPE html>/);
    assert.match(out.code, /data-pc-id="f1"/);
    assert.match(out.code, /Hello/);
  });

  it("exports HTML without invalid custom tags", () => {
    const f = frame("f1", "Screen", 0, 0, 200, 100);
    f.codeJsxTag = "Header";
    f.codeJsxIntrinsic = false;
    const nodes = { f1: f };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: [] };

    const out = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    assert.doesNotMatch(out.code, /<Header[\s>]/);
    assert.match(out.code, /data-pc-component="Header"/);
  });

  it("exports HTML with data-pc-id for selection subtree", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    const t = text("t1", "f1", "Hello");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };

    const out = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "html",
    });

    assert.equal(out.empty, false);
    assert.match(out.code, /data-pc-id="f1"/);
    assert.match(out.code, /data-pc-id="t1"/);
    assert.match(out.code, /Hello/);
    assert.match(out.code, /<p /);
  });

  it("exports portable React without undefined custom components", () => {
    const f = frame("f1", "Screen", 0, 0, 200, 100);
    f.codeJsxTag = "Header";
    f.codeJsxIntrinsic = false;
    const nodes = { f1: f };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: [] };

    const out = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "react",
    });

    assert.doesNotMatch(out.code, /<Header[\s/>]/);
    assert.match(out.code, /data-pc-component="Header"/);
    assert.match(out.code, /import React from "react"/);
    assert.match(out.code, /export default function Screen/);
  });

  it("exports React JSX for selected frame", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    const t = text("t1", "f1", "Hi");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };

    const out = exportSelectionCode({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
      format: "react",
    });

    assert.match(out.code, /data-pc-id="t1"/);
    assert.match(out.code, /export default function Card/);
    assert.match(out.code, /<p/);
  });
});
