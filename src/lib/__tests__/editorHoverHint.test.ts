import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEditorHintTitle } from "../editorHoverHint";

describe("parseEditorHintTitle", () => {
  it("splits label and single-key shortcut", () => {
    assert.deepEqual(parseEditorHintTitle("Text (T)"), { label: "Text", shortcut: "T" });
  });

  it("keeps suffix after shortcut paren", () => {
    assert.deepEqual(parseEditorHintTitle("Frame tool (F) — device presets & draw custom"), {
      label: "Frame tool — device presets & draw custom",
      shortcut: "F",
    });
  });

  it("returns full title for complex modifier shortcuts", () => {
    assert.deepEqual(parseEditorHintTitle("Undo (⌘Z or Ctrl+Z)"), {
      label: "Undo (⌘Z or Ctrl+Z)",
    });
  });

  it("returns label-only titles unchanged", () => {
    assert.deepEqual(parseEditorHintTitle("Import image"), { label: "Import image" });
  });
});
