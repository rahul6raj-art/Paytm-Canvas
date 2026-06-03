import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearPostCreationPointerSuppress,
  shouldSuppressCanvasPointer,
  suppressPostCreationPointer,
} from "@/lib/canvasCreationGuard";

describe("canvasCreationGuard", () => {
  it("suppresses multiple pointer events until the window expires", () => {
    clearPostCreationPointerSuppress();
    assert.equal(shouldSuppressCanvasPointer(), false);

    suppressPostCreationPointer();
    assert.equal(shouldSuppressCanvasPointer(), true);
    assert.equal(shouldSuppressCanvasPointer(), true);
  });
});
