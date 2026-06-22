import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CANVAS_TOOL_RAIL_TOOLS, CANVAS_TOOL_RAIL_BOTTOM_OFFSET, canvasToolRailTitle, clampCanvasToolRailPosition, defaultCanvasToolRailPosition } from "@/lib/canvasToolRail";
import {
  shapeDrawPreviewKind,
  shapeDrawPreviewBoxBounds,
} from "@/lib/shapeDrawPreview";

const root = process.cwd();

describe("canvasToolRail", () => {
  it("lists primary Figma-style tools", () => {
    assert.ok(CANVAS_TOOL_RAIL_TOOLS.some((t) => t.id === "move"));
    assert.ok(CANVAS_TOOL_RAIL_TOOLS.some((t) => t.id === "pen"));
    assert.equal(canvasToolRailTitle("Move", "V"), "Move (V)");
  });

  it("offsets bottom rail above status chrome", () => {
    assert.equal(CANVAS_TOOL_RAIL_BOTTOM_OFFSET, 16);
  });

  it("centers default tool rail position near workspace bottom", () => {
    const pos = defaultCanvasToolRailPosition(365, 53, { width: 800, height: 600 });
    assert.equal(pos.left, (800 - 365) / 2);
    assert.equal(pos.top, 600 - 53 - CANVAS_TOOL_RAIL_BOTTOM_OFFSET);
  });

  it("clamps dragged tool rail inside workspace padding", () => {
    const clamped = clampCanvasToolRailPosition(900, 700, 365, 53, { width: 800, height: 600 });
    assert.equal(clamped.left, 800 - 365 - 8);
    assert.equal(clamped.top, 600 - 53 - 8);
  });

  it("anchors default tool rail with CSS bottom-center until user drags", () => {
    const rail = readFileSync(join(root, "src/components/editor/CanvasToolRail.tsx"), "utf8");
    const hook = readFileSync(join(root, "src/components/editor/useDraggableCanvasToolRail.ts"), "utf8");
    const lib = readFileSync(join(root, "src/lib/canvasToolRail.ts"), "utf8");
    assert.match(rail, /position == null && `inset-x-0 \$\{CANVAS_TOOL_RAIL_OFFSET_CLASS\} mx-auto`/);
    assert.doesNotMatch(hook, /defaultCanvasToolRailPosition/);
    assert.match(lib, /craft-canvas-tool-rail-position-v2/);
  });
});

describe("shapeDrawPreview", () => {
  it("classifies draft preview kinds", () => {
    assert.equal(shapeDrawPreviewKind({ type: "rectangle", width: 0, height: 0 }), "none");
    assert.equal(shapeDrawPreviewKind({ type: "rectangle", width: 40, height: 20 }), "box");
    assert.equal(
      shapeDrawPreviewKind({
        type: "line",
        width: 10,
        height: 0,
        lineX1: 0,
        lineY1: 0,
        lineX2: 50,
        lineY2: 0,
      }),
      "line",
    );
  });

  it("computes box bounds for in-progress drafts", () => {
    const nodes = {
      r1: {
        id: "r1",
        parentId: null,
        type: "rectangle" as const,
        name: "Rect",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0,
        visible: true,
        locked: false,
      },
    };
    const childOrder = { __root__: ["r1"] };
    const b = shapeDrawPreviewBoxBounds("r1", nodes, childOrder);
    assert.ok(b);
    assert.equal(b!.width, 100);
    assert.equal(b!.height, 50);
  });
});

describe("canvasChromeArtifacts", () => {
  const files = [
    "src/components/editor/CanvasToolRail.tsx",
    "src/components/editor/ShapeDrawPreview.tsx",
    "src/components/editor/SelectionInspectorTools.tsx",
    "src/lib/canvasToolRail.ts",
    "src/lib/shapeDrawPreview.ts",
    "docs/canvas-chrome-track.md",
  ];

  it("includes Track 26 canvas chrome modules", () => {
    for (const rel of files) {
      assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
    }
    const canvas = readFileSync(join(root, "src/components/editor/Canvas.tsx"), "utf8");
    const appShell = readFileSync(join(root, "src/components/editor/AppShell.tsx"), "utf8");
    assert.match(appShell, /CanvasToolRail/);
    assert.match(appShell, /data-canvas-workspace/);
    assert.match(canvas, /ShapeDrawPreview/);
    const inspector = readFileSync(join(root, "src/components/editor/InspectorEmptyState.tsx"), "utf8");
    assert.match(inspector, /SelectionInspectorTools/);
  });
});
