import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeStrokeIntoNode,
  migrateNodeStroke,
  resolveStrokeSpec,
} from "@/lib/strokeSpec";

describe("resolveStrokeSpec", () => {
  it("reads legacy flat fields", () => {
    const spec = resolveStrokeSpec({
      strokeColor: "#ff0000",
      strokeWidth: 3,
      strokeOpacity: 0.5,
      strokeEnabled: true,
      strokePosition: "inside",
      strokeLinejoin: "round",
      strokeLinecap: "square",
      strokeStyle: "dashed",
      strokeDashLength: 8,
      strokeDashGap: 4,
    });
    assert.equal(spec.color, "#ff0000");
    assert.equal(spec.width, 3);
    assert.equal(spec.opacity, 0.5);
    assert.equal(spec.align, "inside");
    assert.equal(spec.join, "round");
    assert.equal(spec.cap, "square");
    assert.deepEqual(spec.dashPattern, [8, 4]);
  });

  it("prefers nested stroke object", () => {
    const spec = resolveStrokeSpec({
      stroke: {
        enabled: true,
        color: "#00ff00",
        width: 2,
        opacity: 1,
        align: "outside",
        join: "bevel",
        cap: "butt",
        dashPattern: [4, 2],
      },
      strokeWidth: 99,
    });
    assert.equal(spec.width, 2);
    assert.equal(spec.align, "outside");
    assert.equal(spec.join, "bevel");
  });

  it("falls back to flat stroke width when nested stroke omits width (WASM round-trip)", () => {
    const spec = resolveStrokeSpec({
      strokeWidth: 4,
      strokeColor: "#111111",
      strokeEnabled: true,
      stroke: {
        enabled: true,
        join: "miter",
        cap: "butt",
        dashPattern: [],
      },
    });
    assert.equal(spec.width, 4);
    assert.equal(spec.color, "#111111");
    assert.equal(spec.enabled, true);
  });
});

describe("mergeStrokeIntoNode", () => {
  it("syncs flat and nested when width changes", () => {
    const merged = mergeStrokeIntoNode(
      { strokeWidth: 1, strokeColor: "#000", strokeEnabled: true },
      { strokeWidth: 6 },
    );
    assert.equal(merged.strokeWidth, 6);
    assert.equal(merged.stroke?.width, 6);
  });
});

describe("migrateNodeStroke", () => {
  it("adds stroke object from legacy fields", () => {
    const node = migrateNodeStroke({
      id: "a",
      parentId: null,
      type: "rectangle",
      name: "R",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      strokeWidth: 2,
      strokeColor: "#111",
    });
    assert.ok(node.stroke);
    assert.equal(node.stroke!.width, 2);
  });
});
