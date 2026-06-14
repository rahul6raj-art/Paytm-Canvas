import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import { nodeToReactStyle } from "@/lib/codeRoundTrip/reactStyle";
import { reactStyleToInlineCss } from "@/lib/codeExport/htmlExport";
import { newGradientStopId } from "@/lib/fillGradient";

describe("reactStyle export parity", () => {
  it("exports linear-gradient backgrounds for gradient fills", () => {
    const node: EditorNode = {
      id: "r1",
      parentId: "f1",
      type: "rectangle",
      name: "Card",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#00b8f5",
      fillType: "gradient",
      fillGradient: {
        kind: "linear",
        transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 120 },
        handles: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 1, y: 0 },
        ],
        stops: [
          { id: newGradientStopId(), color: "#00b8f5", position: 0 },
          { id: newGradientStopId(), color: "#012a72", position: 100 },
        ],
      },
    };
    const css = reactStyleToInlineCss(nodeToReactStyle(node));
    assert.match(css, /background:\s*linear-gradient/i);
    assert.match(css, /#00b8f5/i);
  });

  it("clips text layers to prevent overlap in HTML export", () => {
    const node: EditorNode = {
      id: "t1",
      parentId: "f1",
      type: "text",
      name: "Greeting",
      x: 64,
      y: 4,
      width: 220,
      height: 28,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      content: "Good Morning, Rahul",
      fill: "#282828",
      fontSize: 18,
      fontWeight: 700,
    };
    const css = reactStyleToInlineCss(nodeToReactStyle(node));
    assert.match(css, /overflow:\s*hidden/);
    assert.match(css, /line-height:\s*22\.5px/);
  });
});
