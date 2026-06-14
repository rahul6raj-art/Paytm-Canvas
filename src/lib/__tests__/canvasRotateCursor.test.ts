import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANVAS_ROTATE_CURSOR_FALLBACK,
  rotateCursorAngleForHandle,
  rotateCursorAngleFromOutward,
  rotateCursorCssForAngle,
  rotateCursorCssForHandle,
  rotateCursorCssForWorldOutward,
} from "@/lib/canvasRotateCursor";

describe("canvasRotateCursor", () => {
  it("generates a data-url custom cursor with default fallback", () => {
    const css = rotateCursorCssForAngle(0);
    assert.ok(css.includes(`url("data:image/svg+xml;base64,`));
    assert.ok(css.includes(CANVAS_ROTATE_CURSOR_FALLBACK));
    assert.ok(css.includes("16 16"));
  });

  it("caches cursor css per rounded angle", () => {
    const a = rotateCursorCssForAngle(33.2);
    const b = rotateCursorCssForAngle(33.4);
    assert.equal(a, b);
  });

  it("orients glyph opposite outward (arc opens toward selection)", () => {
    assert.equal(rotateCursorAngleFromOutward(45), 180);
    assert.equal(rotateCursorAngleFromOutward(135), 270);
    assert.equal(rotateCursorAngleFromOutward(225), 0);
    assert.equal(rotateCursorAngleFromOutward(315), 90);
    assert.equal(rotateCursorAngleFromOutward(-90), 45);
  });

  it("orients cursor per corner handle on unrotated selections", () => {
    assert.equal(rotateCursorAngleForHandle("se", 0), 180);
    assert.equal(rotateCursorAngleForHandle("sw", 0), 270);
    assert.equal(rotateCursorAngleForHandle("nw", 0), 0);
    assert.equal(rotateCursorAngleForHandle("ne", 0), 90);
    assert.equal(rotateCursorAngleForHandle("top", 0), 45);
  });

  it("spins cursor with selection rotation", () => {
    assert.equal(rotateCursorAngleForHandle("se", 30), 210);
    const nw = rotateCursorCssForHandle("nw", 0);
    const ne = rotateCursorCssForHandle("ne", 0);
    assert.notEqual(nw, ne);
    const rotated = rotateCursorCssForHandle("nw", 45);
    assert.notEqual(nw, rotated);
  });

  it("uses world geometry for non-square selections", () => {
    const center = { x: 100, y: 100 };
    const wideSe = rotateCursorCssForWorldOutward({ x: 200, y: 130 }, center);
    const tallSe = rotateCursorCssForWorldOutward({ x: 130, y: 200 }, center);
    assert.notEqual(wideSe, tallSe);
  });
});
