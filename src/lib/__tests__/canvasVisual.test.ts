import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CANVAS_BACKGROUND,
  displayCanvasBackground,
  isDefaultLightWorkspaceBackground,
  isThemeLinkedWorkspaceBackground,
  themeCanvasWorkspaceHex,
} from "@/lib/canvasVisual";

describe("canvasVisual", () => {
  it("treats AI pasteboard grey as a default light workspace", () => {
    assert.equal(isDefaultLightWorkspaceBackground("#e8eaed"), true);
  });

  it("maps default pasteboards to theme workspace colors", () => {
    assert.equal(displayCanvasBackground("#e8eaed", "dark"), "#1e1e1e");
    assert.equal(displayCanvasBackground(DEFAULT_CANVAS_BACKGROUND, "light"), "#ffffff");
    assert.equal(themeCanvasWorkspaceHex("dark"), "#1e1e1e");
    assert.equal(themeCanvasWorkspaceHex("light"), "#ffffff");
  });

  it("treats legacy dark workspace hex as theme-linked", () => {
    assert.equal(isThemeLinkedWorkspaceBackground("#212121"), true);
    assert.equal(isThemeLinkedWorkspaceBackground("#1e1e1e"), false);
    assert.equal(displayCanvasBackground("#212121", "light"), "#ffffff");
  });

  it("keeps custom dark pasteboards in dark UI theme", () => {
    assert.equal(displayCanvasBackground("#1a1a2e", "dark"), "#1a1a2e");
  });
});
