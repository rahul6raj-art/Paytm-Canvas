import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keyboardNudgeStep } from "@/lib/panelFieldKeyboard";

describe("panelFieldKeyboard", () => {
  it("scales nudge step with shift and alt", () => {
    assert.equal(keyboardNudgeStep(1, 0, false, false), 1);
    assert.equal(keyboardNudgeStep(1, 0, true, false), 10);
    assert.equal(keyboardNudgeStep(1, 0, false, true), 0.1);
    assert.equal(keyboardNudgeStep(0.5, 1, false, false), 0.5);
    assert.equal(keyboardNudgeStep(0.5, 1, true, false), 5);
  });
});
