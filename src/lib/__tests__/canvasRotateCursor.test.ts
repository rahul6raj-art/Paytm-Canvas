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
  it("builds a tldraw-style SVG rotate cursor with fallback", () => {
    const css = rotateCursorCssForAngle(0);
    assert.match(css, /^url\("data:image\/svg\+xml;base64,/);
    assert.match(css, new RegExp(`${CANVAS_ROTATE_CURSOR_FALLBACK}$`));
    assert.equal(rotateCursorCssForAngle(0), rotateCursorCssForAngle(0));

    const decoded = Buffer.from(
      css.match(/^url\("data:image\/svg\+xml;base64,([^"]+)/)![1],
      "base64",
    ).toString("utf8");
    assert.match(decoded, /M22\.4789 9\.45728/);
    assert.match(decoded, /feDropShadow/);
  });

  it("orients cursor from handle and world outward geometry", () => {
    assert.equal(
      rotateCursorCssForHandle("nw", 0),
      rotateCursorCssForAngle(rotateCursorAngleForHandle("nw", 0)),
    );
    const hit = { x: 200, y: 130 };
    const center = { x: 100, y: 100 };
    const outwardDeg = (Math.atan2(hit.y - center.y, hit.x - center.x) * 180) / Math.PI;
    assert.equal(
      rotateCursorCssForWorldOutward(hit, center),
      rotateCursorCssForAngle(rotateCursorAngleFromOutward(outwardDeg)),
    );
  });

  it("orients glyph opposite outward (arc opens toward selection)", () => {
    assert.equal(rotateCursorAngleFromOutward(45), 180);
    assert.equal(rotateCursorAngleFromOutward(135), 270);
    assert.equal(rotateCursorAngleFromOutward(225), 0);
    assert.equal(rotateCursorAngleFromOutward(315), 90);
    assert.equal(rotateCursorAngleFromOutward(-90), 45);
  });

  it("orients on-canvas glyph per corner handle on unrotated selections", () => {
    assert.equal(rotateCursorAngleForHandle("se", 0), 180);
    assert.equal(rotateCursorAngleForHandle("sw", 0), 270);
    assert.equal(rotateCursorAngleForHandle("nw", 0), 0);
    assert.equal(rotateCursorAngleForHandle("ne", 0), 90);
    assert.equal(rotateCursorAngleForHandle("top", 0), 45);
  });

  it("spins on-canvas glyph with selection rotation", () => {
    assert.equal(rotateCursorAngleForHandle("se", 30), 210);
  });
});
