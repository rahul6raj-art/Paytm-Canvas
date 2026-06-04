import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEditHandles } from "../editHandles";
import type { EditorNode } from "@/stores/useEditorStore";

describe("getEditHandles", () => {
  it("returns corner radius handles for rectangles", () => {
    const node = {
      type: "rectangle",
      width: 100,
      height: 80,
      cornerRadius: 4,
      visible: true,
      locked: false,
    } as EditorNode;
    const handles = getEditHandles(node);
    assert.equal(handles.filter((h) => h.kind === "cornerRadius").length, 4);
  });

  it("returns arc handles for ellipses", () => {
    const node = {
      type: "ellipse",
      width: 100,
      height: 80,
    } as EditorNode;
    const handles = getEditHandles(node);
    assert.ok(handles.some((h) => h.kind === "ellipseArcStart"));
    assert.ok(handles.some((h) => h.kind === "ellipseArcEnd"));
    assert.ok(handles.some((h) => h.kind === "ellipseArcRatio"));
  });

  it("returns polygon side and corner handles", () => {
    const node = {
      type: "path",
      width: 100,
      height: 100,
      polygonSides: 6,
      starPoints: undefined,
    } as EditorNode;
    const handles = getEditHandles(node);
    assert.ok(handles.some((h) => h.kind === "polygonSides"));
    assert.ok(handles.some((h) => h.kind === "polygonCornerRadius"));
  });
});
