import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANVAS_WORKSPACE_DARK,
  DEFAULT_CANVAS_BACKGROUND,
  displayCanvasBackground,
  isDefaultLightWorkspaceBackground,
} from "@/lib/canvasVisual";

describe("canvasVisual", () => {
  it("treats AI pasteboard grey as a default light workspace", () => {
    assert.equal(isDefaultLightWorkspaceBackground("#e8eaed"), true);
  });

  it("maps default light pasteboards to dark workspace in dark UI theme", () => {
    assert.equal(displayCanvasBackground("#e8eaed", "dark"), CANVAS_WORKSPACE_DARK);
    assert.equal(displayCanvasBackground(DEFAULT_CANVAS_BACKGROUND, "dark"), CANVAS_WORKSPACE_DARK);
  });

  it("normalizes default light pasteboards to the standard workspace in light UI theme", () => {
    assert.equal(displayCanvasBackground("#e8eaed", "light"), DEFAULT_CANVAS_BACKGROUND);
  });

  it("keeps custom dark pasteboards in dark UI theme", () => {
    assert.equal(displayCanvasBackground("#1a1a2e", "dark"), "#1a1a2e");
  });
});
