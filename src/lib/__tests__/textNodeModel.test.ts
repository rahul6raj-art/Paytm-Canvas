import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoResizeToTextResizeMode, textResizeModeToAutoResize } from "@/lib/text/autoResizeMode";
import { textResizePatch, normalizeTextResizeMode } from "@/lib/text/textNodeModel";
import { verticalContentOffsetY } from "@/lib/text/textVerticalAlign";

describe("textNodeModel", () => {
  it("maps autoResize labels to resize modes", () => {
    assert.equal(autoResizeToTextResizeMode("width-height"), "auto-width");
    assert.equal(autoResizeToTextResizeMode("height"), "auto-height");
    assert.equal(autoResizeToTextResizeMode("fixed"), "fixed");
    assert.equal(autoResizeToTextResizeMode("none"), "fixed");
    assert.equal(textResizeModeToAutoResize("auto-height"), "height");
    assert.equal(textResizeModeToAutoResize("fixed"), "none");
  });

  it("textResizePatch keeps fields in sync", () => {
    assert.deepEqual(textResizePatch("fixed"), {
      textResizeMode: "fixed",
      autoResize: "none",
    });
  });

  it("normalizeTextResizeMode prefers autoResize alias", () => {
    assert.equal(normalizeTextResizeMode(undefined, "height"), "auto-height");
  });

  it("normalizeTextResizeMode prefers explicit textResizeMode over autoResize", () => {
    assert.equal(normalizeTextResizeMode("auto-height", "width-height"), "auto-height");
  });

  it("verticalContentOffsetY centers and bottoms content", () => {
    assert.equal(verticalContentOffsetY(20, 100, "top"), 0);
    assert.equal(verticalContentOffsetY(20, 100, "middle"), 40);
    assert.equal(verticalContentOffsetY(20, 100, "bottom"), 80);
  });

  it("verticalContentOffsetY keeps bottom/middle anchored when content overflows", () => {
    assert.equal(verticalContentOffsetY(100, 20, "top"), 0);
    assert.equal(verticalContentOffsetY(100, 20, "middle"), -40);
    assert.equal(verticalContentOffsetY(100, 20, "bottom"), -80);
  });
});
