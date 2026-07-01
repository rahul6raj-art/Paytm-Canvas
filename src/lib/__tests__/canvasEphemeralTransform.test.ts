import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  applyDragPreview,
  applyPanPreview,
  applyWheelViewportPreview,
  clearDragPreview,
  clearPanPreview,
  clearWheelViewportPreview,
  getDragPreviewSnapshot,
  getEffectiveViewportSnapshot,
  getPanPreviewSnapshot,
  PAN_PREVIEW_IDLE,
  readDragPreviewDelta,
  readPanPreviewDelta,
  readWheelViewportPreview,
  registerCanvasSceneTransform,
  resolveEffectiveViewport,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";

describe("canvasEphemeralTransform", () => {
  afterEach(() => {
    clearDragPreview();
    clearPanPreview();
    clearWheelViewportPreview();
    registerCanvasSceneTransform(null);
  });

  it("applyPanPreview stores delta and updates scene transform", () => {
    const style = {
      transform: "",
      removeProperty(name: string) {
        if (name === "transform") this.transform = "";
      },
    };
    const scene = { style } as unknown as HTMLElement;
    registerCanvasSceneTransform(scene);
    applyPanPreview({ x: 10, y: 20 }, 1.5, 5, -3);
    assert.deepEqual(readPanPreviewDelta(), { dx: 5, dy: -3 });
    assert.equal(scene.style.transform, "translate3d(15px, 17px, 0) scale(1.5)");
    clearPanPreview();
    assert.equal(scene.style.transform, "");
  });

  it("getPanPreviewSnapshot returns a stable reference when idle", () => {
    assert.equal(getPanPreviewSnapshot(), getPanPreviewSnapshot());
    applyPanPreview({ x: 0, y: 0 }, 1, 3, 4);
    const a = getPanPreviewSnapshot();
    const b = getPanPreviewSnapshot();
    assert.equal(a, b);
    assert.deepEqual(a, { dx: 3, dy: 4 });
    clearPanPreview();
    assert.equal(getPanPreviewSnapshot(), PAN_PREVIEW_IDLE);
  });

  it("applyWheelViewportPreview updates transform without store commit", () => {
    const style = {
      transform: "",
      willChange: "",
      removeProperty(name: string) {
        if (name === "transform") this.transform = "";
        if (name === "will-change") this.willChange = "";
      },
    };
    const scene = { style } as unknown as HTMLElement;
    registerCanvasSceneTransform(scene);
    applyWheelViewportPreview({ x: 40, y: 60 }, 0.5);
    assert.equal(scene.style.transform, "translate3d(40px, 60px, 0) scale(0.5)");
    assert.equal(readWheelViewportPreview()?.zoom, 0.5);
    clearWheelViewportPreview();
    assert.equal(scene.style.transform, "");
  });

  it("resolveEffectiveViewport prefers wheel preview over store pan", () => {
    applyWheelViewportPreview({ x: 5, y: 6 }, 2);
    const effective = resolveEffectiveViewport({ x: 0, y: 0 }, 1);
    assert.deepEqual(effective.pan, { x: 5, y: 6 });
    assert.equal(effective.zoom, 2);
    clearWheelViewportPreview();
  });

  it("applyDragPreview notifies subscribers", () => {
    let count = 0;
    const unsub = subscribeDragPreview(() => {
      count += 1;
    });
    applyDragPreview(["a"], 12, 8);
    assert.equal(count, 1);
    assert.deepEqual(getDragPreviewSnapshot(), { dx: 12, dy: 8, movingIds: ["a"] });
    assert.deepEqual(readDragPreviewDelta(), { dx: 12, dy: 8, movingIds: ["a"] });
    unsub();
    clearDragPreview();
    assert.equal(getDragPreviewSnapshot(), null);
  });
});
