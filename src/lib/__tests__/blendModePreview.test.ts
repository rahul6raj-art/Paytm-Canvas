import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearBlendModePreview,
  getBlendModePreview,
  nodeBlendModeForPreview,
  setBlendModePreview,
} from "@/lib/blendModePreview";

describe("blendModePreview", () => {
  it("set and clear preview state", () => {
    clearBlendModePreview();
    assert.equal(getBlendModePreview(), null);
    setBlendModePreview(["a", "b"], "multiply");
    assert.deepEqual(getBlendModePreview(), { nodeIds: ["a", "b"], blendMode: "multiply" });
    clearBlendModePreview();
    assert.equal(getBlendModePreview(), null);
  });

  it("nodeBlendModeForPreview overrides only targeted ids", () => {
    const preview = { nodeIds: ["a"], blendMode: "screen" as const };
    const rect = { type: "rectangle" as const, blendMode: "normal" as const };
    assert.equal(nodeBlendModeForPreview("a", rect, preview).blendMode, "screen");
    assert.equal(nodeBlendModeForPreview("b", rect, preview).blendMode, "normal");
  });
});
