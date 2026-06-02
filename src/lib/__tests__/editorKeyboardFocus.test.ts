import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isToolShortcutEvent,
  shouldYieldShortcutsToTyping,
  toolFromShortcutKey,
} from "@/lib/editorKeyboardFocus";

function fakeInput(): HTMLInputElement {
  return { tagName: "INPUT", isContentEditable: false } as HTMLInputElement;
}

function fakeTextarea(): HTMLTextAreaElement {
  return { tagName: "TEXTAREA", isContentEditable: false } as HTMLTextAreaElement;
}

describe("editorKeyboardFocus shortcuts", () => {
  it("maps tool keys", () => {
    assert.equal(toolFromShortcutKey("v"), "move");
    assert.equal(toolFromShortcutKey("R"), "rect");
  });

  it("detects tool shortcut keys", () => {
    const e = { key: "v", metaKey: false, ctrlKey: false, altKey: false } as KeyboardEvent;
    assert.equal(isToolShortcutEvent(e), true);
  });

  it("does not yield modifier shortcuts", () => {
    const e = { key: "z", metaKey: true, ctrlKey: false, altKey: false } as KeyboardEvent;
    assert.equal(shouldYieldShortcutsToTyping(e, null), false);
  });

  it("does not yield Delete in single-line inspector inputs", () => {
    const e = {
      key: "Delete",
      code: "Delete",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as KeyboardEvent;
    assert.equal(shouldYieldShortcutsToTyping(e, fakeInput()), false);
  });

  it("yields Delete in multiline code import textarea", () => {
    const e = {
      key: "Backspace",
      code: "Backspace",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as KeyboardEvent;
    assert.equal(shouldYieldShortcutsToTyping(e, fakeTextarea()), true);
  });
});
