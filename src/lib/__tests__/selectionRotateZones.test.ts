import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANVAS_ROTATE_CORNER_GAP_SCREEN_PX,
  pointerOnCornerHandleRotateHalf,
  rotateCornerZoneOffsetWorld,
  rotateEdgeBandsForAxisBounds,
  rotateEdgeBandsForCorners,
  rotateZonesForAxisBounds,
  rotateZonesForCornerHandles,
  topRotateHandleWorld,
} from "@/lib/selectionRotateZones";
import { CANVAS_HANDLE_SCREEN_PX } from "@/lib/canvasVisual";

describe("selectionRotateZones", () => {
  it("places rotate zones just outside corner resize handles", () => {
    const bounds = { x: 100, y: 200, width: 80, height: 60 };
    const zones = rotateZonesForAxisBounds(bounds, 1);
    const se = zones.find((z) => z.handle === "se");
    assert.ok(se);
    const cornerX = bounds.x + bounds.width;
    const cornerY = bounds.y + bounds.height;
    const offset = rotateCornerZoneOffsetWorld(1);
    assert.ok(Math.hypot(se!.x - cornerX, se!.y - cornerY) >= offset - 0.01);
    assert.equal(offset, CANVAS_HANDLE_SCREEN_PX / 2 + CANVAS_ROTATE_CORNER_GAP_SCREEN_PX);
    assert.ok(se!.x > cornerX);
    assert.ok(se!.y > cornerY);
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

  it("detects rotate intent on outer half of corner resize handles", () => {
    const el = {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 12, height: 12 }),
    } as HTMLElement;
    assert.equal(pointerOnCornerHandleRotateHalf("nw", 103, 103, el), true);
    assert.equal(pointerOnCornerHandleRotateHalf("nw", 108, 108, el), false);
    assert.equal(pointerOnCornerHandleRotateHalf("se", 108, 108, el), true);
  });

  it("offsets top rotate handle above the top edge", () => {
    const bounds = { x: 0, y: 100, width: 200, height: 50 };
    const top = topRotateHandleWorld(bounds, 1);
    assert.equal(top.x, 100);
    assert.ok(top.y < bounds.y);
  });

  it("places edge rotate bands outside corners on axis-aligned bounds", () => {
    const bounds = { x: 100, y: 200, width: 80, height: 60 };
    const bands = rotateEdgeBandsForAxisBounds(bounds, 1);
    const nwTop = bands.find((b) => b.id === "nw-top");
    const seRight = bands.find((b) => b.id === "se-right");
    assert.ok(nwTop);
    assert.ok(seRight);
    assert.ok(nwTop!.y < bounds.y);
    assert.ok(seRight!.x >= bounds.x + bounds.width);
  });

  it("places edge rotate bands along oriented corner edges", () => {
    const bounds = { x: 50, y: 50, width: 100, height: 80 };
    const handles = [
      { handle: "nw" as const, x: 60, y: 40 },
      { handle: "ne" as const, x: 140, y: 55 },
      { handle: "se" as const, x: 125, y: 120 },
      { handle: "sw" as const, x: 45, y: 105 },
    ];
    const bands = rotateEdgeBandsForCorners(handles, bounds, 1);
    assert.equal(bands.length, 8);
    assert.ok(bands.every((b) => b.transform?.includes("rotate")));
  });
});
