import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { centerProportionalScaleFromWorld, computeResizedBounds } from "@/lib/resize";

const start = { x: 100, y: 100, width: 200, height: 100 };

describe("resize modifiers (Figma-like)", () => {
  it("edge + Shift only changes one dimension (opposite edge fixed)", () => {
    const next = computeResizedBounds(
      "e",
      start,
      { x: 350, y: 150 },
      { shiftKey: true, altKey: false },
      "rectangle",
    );
    assert.equal(next.x, start.x);
    assert.equal(next.y, start.y);
    assert.equal(next.width, 250);
    assert.equal(next.height, start.height);
  });

  it("edge + Option (Alt) follows pointer when resizing from center", () => {
    const cx = start.x + start.width / 2;
    const expanded = computeResizedBounds(
      "e",
      start,
      { x: cx + 80, y: start.y + start.height / 2 },
      { shiftKey: false, altKey: true },
      "rectangle",
    );
    assert.equal(expanded.width, 160);
    assert.equal(expanded.x + expanded.width / 2, cx);

    const shrunk = computeResizedBounds(
      "e",
      start,
      { x: cx + 30, y: start.y + start.height / 2 },
      { shiftKey: false, altKey: true },
      "rectangle",
    );
    assert.equal(shrunk.width, 60);
    assert.ok(shrunk.width < expanded.width);

    const pastCenter = computeResizedBounds(
      "e",
      start,
      { x: cx - 40, y: start.y + start.height / 2 },
      { shiftKey: false, altKey: true },
      "rectangle",
    );
    assert.ok(pastCenter.width <= shrunk.width);
  });

  it("edge + Shift+Option scales proportionally from center", () => {
    const next = computeResizedBounds(
      "e",
      start,
      { x: 350, y: 150 },
      { shiftKey: true, altKey: true },
      "rectangle",
    );
    const ar = start.width / start.height;
    assert.ok(Math.abs(next.width / next.height - ar) < 0.01);
    assert.equal(next.x + next.width / 2, start.x + start.width / 2);
    assert.equal(next.y + next.height / 2, start.y + start.height / 2);
  });

  it("corner + Shift only keeps aspect ratio with opposite corner fixed", () => {
    const next = computeResizedBounds(
      "se",
      start,
      { x: 400, y: 250 },
      { shiftKey: true, altKey: false },
      "rectangle",
    );
    const ar = start.width / start.height;
    assert.equal(next.x, start.x);
    assert.equal(next.y, start.y);
    assert.ok(Math.abs(next.width / next.height - ar) < 0.01);
  });

  it("world center scale stays smooth and proportional (Shift+Option)", () => {
    const center = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
    const p0 = { x: center.x + start.width / 2, y: center.y };
    const p1 = { x: center.x + start.width, y: center.y };
    const next = centerProportionalScaleFromWorld(start, center, p0, p1);
    const ar = start.width / start.height;
    assert.ok(Math.abs(next.width / next.height - ar) < 0.01);
    assert.equal(next.x + next.width / 2, center.x);
    assert.equal(next.y + next.height / 2, center.y);
    assert.equal(next.width, start.width * 2);
    assert.equal(next.height, start.height * 2);
  });

  it("corner + Shift+Option scales proportionally from center", () => {
    const next = computeResizedBounds(
      "se",
      start,
      { x: 400, y: 250 },
      { shiftKey: true, altKey: true },
      "rectangle",
    );
    const ar = start.width / start.height;
    assert.ok(Math.abs(next.width / next.height - ar) < 0.01);
    assert.equal(next.x + next.width / 2, start.x + start.width / 2);
    assert.equal(next.y + next.height / 2, start.y + start.height / 2);
  });
});
