import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rotateZonesForAxisBounds,
  rotateZonesForCornerHandles,
  topRotateHandleWorld,
} from "@/lib/selectionRotateZones";

describe("selectionRotateZones", () => {
  it("places rotate zones outside axis-aligned corners", () => {
    const bounds = { x: 100, y: 200, width: 80, height: 60 };
    const zones = rotateZonesForAxisBounds(bounds, 1);
    const se = zones.find((z) => z.handle === "se");
    assert.ok(se);
    assert.ok(se!.x > bounds.x + bounds.width);
    assert.ok(se!.y > bounds.y + bounds.height);
  });

  it("places rotate zones outside oriented corner handles", () => {
    const bounds = { x: 50, y: 50, width: 100, height: 80 };
    const handles = [
      { handle: "nw" as const, x: 60, y: 40 },
      { handle: "ne" as const, x: 140, y: 55 },
      { handle: "se" as const, x: 125, y: 120 },
      { handle: "sw" as const, x: 45, y: 105 },
    ];
    const zones = rotateZonesForCornerHandles(handles, bounds, 1);
    const nw = zones.find((z) => z.handle === "nw");
    assert.ok(nw);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    assert.ok(Math.hypot(nw!.x - cx, nw!.y - cy) > Math.hypot(60 - cx, 40 - cy));
  });

  it("offsets top rotate handle above the top edge", () => {
    const bounds = { x: 0, y: 100, width: 200, height: 50 };
    const top = topRotateHandleWorld(bounds, 1);
    assert.equal(top.x, 100);
    assert.ok(top.y < bounds.y);
  });
});
