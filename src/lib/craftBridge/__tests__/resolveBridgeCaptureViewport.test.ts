import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PML_PHONE_VIEWPORT,
  PML_PHONE_VIEWPORT_HEIGHT,
} from "@/lib/craftBridge/pmlScreenMetrics";
import { resolveBridgeCaptureViewport } from "@/lib/craftBridge/resolveBridgeCaptureViewport";

describe("resolveBridgeCaptureViewport", () => {
  it("ignores desktop client viewport for PML ?screen= URLs", () => {
    const vp = resolveBridgeCaptureViewport(
      { width: 1920, height: 1080 },
      "http://localhost:5173/?screen=onboarding&step=confirm-pan",
    );
    assert.equal(vp.width, PML_PHONE_VIEWPORT.width);
    assert.equal(vp.height, PML_PHONE_VIEWPORT_HEIGHT);
    assert.equal(vp.phoneCapture, true);
  });

  it("defaults to PML phone viewport when client size is omitted for ?screen= URLs", () => {
    const vp = resolveBridgeCaptureViewport(undefined, "http://localhost:5173/?screen=home");
    assert.equal(vp.width, PML_PHONE_VIEWPORT.width);
    assert.equal(vp.height, PML_PHONE_VIEWPORT_HEIGHT);
    assert.equal(vp.phoneCapture, true);
  });

  it("defaults to desktop viewport for generic route URLs", () => {
    const vp = resolveBridgeCaptureViewport(undefined, "http://localhost:5173/dashboard");
    assert.equal(vp.width, 1280);
    assert.equal(vp.height, 800);
    assert.equal(vp.phoneCapture, false);
  });

  it("uses client viewport for desktop / Storybook captures", () => {
    const vp = resolveBridgeCaptureViewport({ width: 1280, height: 800 });
    assert.equal(vp.width, 1280);
    assert.equal(vp.height, 800);
    assert.equal(vp.phoneCapture, false);
  });

  it("treats narrow viewports as phone captures", () => {
    const vp = resolveBridgeCaptureViewport({ width: 390, height: 844 });
    assert.equal(vp.phoneCapture, true);
  });
});
