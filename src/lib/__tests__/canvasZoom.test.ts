import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickViewportRootIds, viewportForRootNodes } from "@/lib/canvasZoom";

describe("canvasZoom viewport fit", () => {
  it("uses all roots when they are close together", () => {
    const nodes = {
      a: { x: 80, y: 80, width: 400, height: 300 },
      b: { x: 520, y: 80, width: 400, height: 300 },
    };
    assert.deepEqual(pickViewportRootIds(nodes, ["a", "b"]), ["a", "b"]);
    const vp = viewportForRootNodes(nodes, ["a", "b"], 1200, 800, { fit: "primary" });
    assert.ok(vp && vp.zoom > 0.2);
  });

  it("fits the largest root when roots are far apart", () => {
    const nodes = {
      small: { x: 80, y: 80, width: 200, height: 150, type: "frame" },
      main: { x: 40_000, y: 40_000, width: 1440, height: 900, type: "frame" },
      stray: { x: 0, y: 0, width: 100, height: 80, type: "frame" },
    };
    assert.deepEqual(pickViewportRootIds(nodes, ["small", "main", "stray"]), ["main"]);
    const vp = viewportForRootNodes(nodes, ["small", "main", "stray"], 1200, 800, {
      fit: "primary",
    });
    assert.ok(vp && vp.zoom > 0.15);
    assert.ok(vp.zoom < 1.25);
  });

  it("skips oversized pasteboard roots when picking primary", () => {
    const nodes = {
      pasteboard: { x: 0, y: 0, width: 50_000, height: 50_000, type: "frame", name: "Cover" },
      screen: { x: 120, y: 120, width: 390, height: 844, type: "frame", name: "Mobile" },
    };
    assert.deepEqual(pickViewportRootIds(nodes, ["pasteboard", "screen"]), ["screen"]);
  });
});
