import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBridgeCaptureFormState } from "@/lib/webImport/server/applyBridgeCaptureInteractiveState";

describe("parseBridgeCaptureFormState", () => {
  it("reads onboarding mobile consent + phone from capture URL", () => {
    const state = parseBridgeCaptureFormState(
      "http://127.0.0.1:5173/?screen=onboarding&theme=light&step=mobile&craftAgreed=1&craftMobile=9876543210",
    );
    assert.equal(state.screen, "onboarding");
    assert.equal(state.step, "mobile");
    assert.equal(state.agreed, true);
    assert.equal(state.mobileDigits, "9876543210");
    assert.equal(state.maritalStatus, null);
  });

  it("reads tell-us-more marital selection from capture URL", () => {
    const state = parseBridgeCaptureFormState(
      "http://127.0.0.1:5173/?screen=onboarding&step=tell-us-more&craftTellUsCitizen=1&craftMarital=married",
    );
    assert.equal(state.step, "tell-us-more");
    assert.equal(state.tellUsCitizen, true);
    assert.equal(state.maritalStatus, "married");
  });

  it("normalizes formatted phone values to 10 digits", () => {
    const state = parseBridgeCaptureFormState(
      "http://127.0.0.1:5173/?screen=onboarding&step=mobile&craftMobile=%2B919876543210",
    );
    assert.equal(state.mobileDigits, "9876543210");
  });

  it("reads signature draw state from capture URL", () => {
    const state = parseBridgeCaptureFormState(
      "http://127.0.0.1:5173/?screen=onboarding&step=signature-draw&craftSigDrawn=1&craftSigMethod=draw",
    );
    assert.equal(state.step, "signature-draw");
    assert.equal(state.sigDrawn, true);
    assert.equal(state.sigMethod, "draw");
  });

  it("ignores unrelated screens", () => {
    const state = parseBridgeCaptureFormState(
      "http://127.0.0.1:5173/?screen=home&craftAgreed=1&craftMobile=9876543210",
    );
    assert.equal(state.screen, "home");
    assert.equal(state.step, null);
  });
});
