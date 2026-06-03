import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeResizedBounds } from "@/lib/resize";

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
