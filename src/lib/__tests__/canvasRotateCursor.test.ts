import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANVAS_ROTATE_CURSOR_FALLBACK,
  rotateCursorCssForAngle,
  rotateCursorCssForHandle,
} from "@/lib/canvasRotateCursor";

describe("canvasRotateCursor", () => {
  it("generates a data-url custom cursor with grab fallback", () => {
    const css = rotateCursorCssForAngle(0);
    assert.ok(css.includes(`url("data:image/svg+xml;base64,`));
    assert.ok(css.includes(CANVAS_ROTATE_CURSOR_FALLBACK));
    assert.ok(css.includes("12 12"));
  });

  it("caches cursor css per rounded angle", () => {
    const a = rotateCursorCssForAngle(33.2);
    const b = rotateCursorCssForAngle(33.4);
    assert.equal(a, b);
  });

  it("orients cursor per handle and selection rotation", () => {
    const nw = rotateCursorCssForHandle("nw", 0);
    const ne = rotateCursorCssForHandle("ne", 0);
    assert.notEqual(nw, ne);
    const rotated = rotateCursorCssForHandle("nw", 45);
    assert.notEqual(nw, rotated);
  });
});
