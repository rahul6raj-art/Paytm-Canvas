import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  noteKeyboardEditorPaste,
  shouldSuppressDuplicateEditorPaste,
} from "../editorPasteDedup";

describe("editorPasteDedup", () => {
  it("suppresses paste event immediately after keyboard paste", () => {
    noteKeyboardEditorPaste();
    assert.equal(shouldSuppressDuplicateEditorPaste(), true);
  });

  it("allows paste event after keyboard window expires", async () => {
    noteKeyboardEditorPaste();
    await new Promise((r) => setTimeout(r, 550));
    assert.equal(shouldSuppressDuplicateEditorPaste(), false);
  });
});
