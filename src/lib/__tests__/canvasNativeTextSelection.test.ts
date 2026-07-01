import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  beginCanvasNativeTextSelectionSuppression,
  clearBrowserTextSelection,
} from "@/lib/canvasNativeTextSelection";

describe("canvasNativeTextSelection", () => {
  it("blocks selectstart while suppression is active", () => {
    if (typeof document === "undefined") return;

    const end = beginCanvasNativeTextSelectionSuppression();
    try {
      assert.equal(document.body.style.userSelect, "none");

      const ev = new Event("selectstart", { cancelable: true });
      document.dispatchEvent(ev);
      assert.equal(ev.defaultPrevented, true);
    } finally {
      end();
    }
  });

  it("clearBrowserTextSelection is safe without a document selection", () => {
    assert.doesNotThrow(() => clearBrowserTextSelection());
  });
});
