import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizedRange,
  textareaDomSelectionRange,
  textareaSelectionForStore,
} from "@/lib/text/textCursor";

describe("textCursor selection direction", () => {
  it("normalizedRange orders backward selections", () => {
    assert.deepEqual(normalizedRange(8, 3), { start: 3, end: 8 });
  });

  it("textareaDomSelectionRange always uses start <= end for DOM APIs", () => {
    assert.deepEqual(textareaDomSelectionRange(8, 3), { start: 3, end: 8 });
    assert.deepEqual(textareaDomSelectionRange(3, 8), { start: 3, end: 8 });
  });

  it("preserves backward anchor when textarea normalizes selection range", () => {
    const next = textareaSelectionForStore(8, 5, 5, 8);
    assert.deepEqual(next, { anchor: 8, focus: 5 });
  });

  it("preserves forward anchor when textarea matches store range", () => {
    const next = textareaSelectionForStore(3, 8, 3, 8);
    assert.deepEqual(next, { anchor: 3, focus: 8 });
  });

  it("adopts textarea range when user changes selection extent", () => {
    const next = textareaSelectionForStore(8, 5, 2, 8);
    assert.deepEqual(next, { anchor: 2, focus: 8 });
  });

  it("collapses to caret when textarea has empty selection", () => {
    const next = textareaSelectionForStore(8, 5, 4, 4);
    assert.deepEqual(next, { anchor: 4, focus: 4 });
  });
});
