import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canvasChromeForeground,
  defaultCanvasForegroundColor,
  isDarkCanvasBackground,
} from "@/lib/canvasForeground";

describe("canvasForeground", () => {
  it("treats light greys as light backgrounds", () => {
    assert.equal(isDarkCanvasBackground("#e5e5e5"), false);
    assert.equal(canvasChromeForeground("#e5e5e5").defaultText, "#000000");
  });

  it("treats dark blues as dark backgrounds", () => {
    assert.equal(isDarkCanvasBackground("#0f172a"), true);
    const chrome = canvasChromeForeground("#0f172a");
    assert.equal(chrome.defaultText, "#ffffff");
    assert.equal(chrome.rulerBg, "#2c2c2c");
    assert.equal(chrome.rulerLabel, "#a3a3a3");
  });

  it("defaultCanvasForegroundColor follows app theme", () => {
    assert.equal(defaultCanvasForegroundColor("light"), "#000000");
    assert.equal(defaultCanvasForegroundColor("dark"), "#ffffff");
  });
});
