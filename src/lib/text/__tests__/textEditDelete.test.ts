import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTextEditDelete } from "@/lib/text/textEditDelete";

describe("applyTextEditDelete", () => {
  it("backspace removes one character before the caret", () => {
    const r = applyTextEditDelete("hello", 3, 3, "backspace");
    assert.deepEqual(r, { content: "helo", anchor: 2, focus: 2 });
  });

  it("delete removes one character after the caret", () => {
    const r = applyTextEditDelete("hello", 2, 2, "delete");
    assert.deepEqual(r, { content: "helo", anchor: 2, focus: 2 });
  });

  it("backspace removes the selected range", () => {
    const r = applyTextEditDelete("hello", 1, 4, "backspace");
    assert.deepEqual(r, { content: "ho", anchor: 1, focus: 1 });
  });

  it("returns null at start for backspace and end for delete", () => {
    assert.equal(applyTextEditDelete("hi", 0, 0, "backspace"), null);
    assert.equal(applyTextEditDelete("hi", 2, 2, "delete"), null);
  });
});
