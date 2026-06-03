import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  ellipseArcClipPathCss,
  ellipseArcExportStyle,
  ellipseHasCustomArc,
} from "@/lib/shapes/ellipseArcExport";
import { nodeToReactStyle } from "@/lib/codeRoundTrip/reactStyle";
import { reactStyleToInlineCss } from "@/lib/codeExport/htmlExport";

function pieEllipse(): EditorNode {
  return {
    id: "e1",
    parentId: "f1",
    type: "ellipse",
    name: "Pie",
    x: 0,
    y: 0,
    width: 75,
    height: 75,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#f4a3a8",
    fillEnabled: true,
    arcStartDeg: 0,
    arcSweepDeg: 270,
    arcInnerRadiusRatio: 0,
  } as EditorNode;
}

describe("ellipseArcExport", () => {
  it("detects custom arc geometry", () => {
    assert.equal(ellipseHasCustomArc(pieEllipse()), true);
    assert.equal(
      ellipseHasCustomArc({
        ...pieEllipse(),
        arcSweepDeg: 360,
        arcInnerRadiusRatio: 0,
      }),
      false,
    );
  });

  it("exports clip-path for pie slice", () => {
    const style = ellipseArcExportStyle(pieEllipse());
    assert.ok(style.clipPath);
    assert.match(String(style.clipPath), /^path\(/);
    assert.equal(style.overflow, "hidden");
    const css = reactStyleToInlineCss(nodeToReactStyle(pieEllipse()));
    assert.match(css, /clip-path:\s*path\(/);
  });

  it("exports border-radius 50% for full oval", () => {
    const full = {
      ...pieEllipse(),
      arcSweepDeg: 360,
      arcInnerRadiusRatio: 0,
    };
    const style = ellipseArcExportStyle(full);
    assert.equal(style.borderRadius, "50%");
    assert.equal(style.clipPath, undefined);
  });

  it("clip path uses evenodd for full donut", () => {
    const clip = ellipseArcClipPathCss(100, 100, 0, 360, 0.4);
    assert.match(clip, /^path\(evenodd,/);
  });
});
