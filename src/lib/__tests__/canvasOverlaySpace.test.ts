import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  orientedBoxOverlayStyle,
  worldRectToOverlay,
  type OverlaySpace,
} from "@/lib/canvasOverlaySpace";

const screenSpace: OverlaySpace = {
  screenSpace: true,
  pan: { x: 100, y: 50 },
  zoom: 6.75,
};

describe("canvasOverlaySpace", () => {
  it("contentAtScreenSize bakes zoom into box size, not the CSS matrix", () => {
    const worldMatrix = { a: 1, b: 0, c: 0, d: 1, e: 3105, f: 1964 };
    const legacy = orientedBoxOverlayStyle(
      worldMatrix,
      45,
      36,
      screenSpace,
      { dx: 0, dy: 0 },
    );
    const styled = orientedBoxOverlayStyle(
      worldMatrix,
      45,
      36,
      screenSpace,
      { dx: 0, dy: 0 },
      { contentAtScreenSize: true },
    );

    assert.equal(legacy.width, 45);
    assert.match(legacy.transform, /6\.75/);
    assert.equal(styled.contentScaleX, 6.75);
    assert.equal(styled.contentScaleY, 6.75);
    assert.equal(styled.width, 45 * 6.75);
    assert.equal(styled.height, 36 * 6.75);
    assert.match(styled.transform, /matrix\(1, 0, 0, 1, 0, 0\)/);
    assert.doesNotMatch(styled.transform, /6\.75/);
  });

  it("contentAtScreenSize matches zoom-scaled world dimensions", () => {
    const worldMatrix = { a: 1, b: 0, c: 0, d: 1, e: 200, f: 120 };
    const styled = orientedBoxOverlayStyle(
      worldMatrix,
      45,
      36,
      screenSpace,
      { dx: 0, dy: 0 },
      { contentAtScreenSize: true },
    );
    const rect = worldRectToOverlay({ x: 200, y: 120, width: 45, height: 36 }, screenSpace);

    assert.equal(styled.width, 45 * screenSpace.zoom);
    assert.equal(styled.height, 36 * screenSpace.zoom);
    assert.ok(Math.abs(styled.width - rect.width) <= 2);
    assert.ok(Math.abs(styled.height - rect.height) <= 2);
  });
});
