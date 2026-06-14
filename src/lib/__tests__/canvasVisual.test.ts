import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANVAS_WORKSPACE_DARK,
  DEFAULT_CANVAS_BACKGROUND,
  displayCanvasBackground,
  isDefaultLightWorkspaceBackground,
  isThemeLinkedWorkspaceBackground,
  themeCanvasWorkspaceHex,
  THEME_CANVAS_WORKSPACE_CSS,
} from "@/lib/canvasVisual";

describe("canvasVisual", () => {
  it("treats AI pasteboard grey as a default light workspace", () => {
    assert.equal(isDefaultLightWorkspaceBackground("#e8eaed"), true);
  });

  it("maps default pasteboards to theme CSS workspace tokens", () => {
    assert.equal(displayCanvasBackground("#e8eaed", "dark"), THEME_CANVAS_WORKSPACE_CSS);
    assert.equal(displayCanvasBackground(DEFAULT_CANVAS_BACKGROUND, "light"), THEME_CANVAS_WORKSPACE_CSS);
    assert.equal(themeCanvasWorkspaceHex("dark"), "#212121");
    assert.equal(themeCanvasWorkspaceHex("light"), "#e8e8e8");
  });

  it("treats legacy dark workspace hex as theme-linked", () => {
    assert.equal(isThemeLinkedWorkspaceBackground(CANVAS_WORKSPACE_DARK), true);
    assert.equal(displayCanvasBackground(CANVAS_WORKSPACE_DARK, "light"), THEME_CANVAS_WORKSPACE_CSS);
  });

  it("keeps custom dark pasteboards in dark UI theme", () => {
    assert.equal(displayCanvasBackground("#1a1a2e", "dark"), "#1a1a2e");
  });
});
