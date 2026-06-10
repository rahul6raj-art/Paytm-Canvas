import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isToolShortcutEvent,
  resolveKeyboardFieldTarget,
  shouldAllowNativeFieldClipboard,
  shouldBlockDeleteSelectionShortcut,
  shouldYieldShortcutsToTyping,
  resolveToolFromKeyboardEvent,
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

  it("resolves shift+pencil and comment tools", () => {
    assert.equal(
      resolveToolFromKeyboardEvent({
        key: "P",
        shiftKey: true,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
      } as KeyboardEvent),
      "pencil",
    );
    assert.equal(
      resolveToolFromKeyboardEvent({
        key: "c",
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
      } as KeyboardEvent),
      "comment",
    );
  });

  it("does not yield modifier shortcuts", () => {
    const e = { key: "z", metaKey: true, ctrlKey: false, altKey: false } as KeyboardEvent;
    assert.equal(shouldYieldShortcutsToTyping(e, null), false);
  });

  it("blocks delete-selection in single-line inspector inputs", () => {
    const e = {
      key: "Delete",
      code: "Delete",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as KeyboardEvent;
    assert.equal(shouldBlockDeleteSelectionShortcut(e, fakeInput()), true);
    assert.equal(shouldYieldShortcutsToTyping(e, fakeInput()), true);
  });

  it("blocks backspace-selection in single-line inspector inputs", () => {
    const e = {
      key: "Backspace",
      code: "Backspace",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as KeyboardEvent;
    assert.equal(shouldBlockDeleteSelectionShortcut(e, fakeInput()), true);
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

  it("yields tool shortcut letters in inspector text inputs (hex fields)", () => {
    const e = {
      key: "f",
      code: "KeyF",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    assert.equal(isToolShortcutEvent(e), true);
    assert.equal(shouldYieldShortcutsToTyping(e, fakeInput()), true);
  });

  it("allows native paste in code import textarea", () => {
    const e = {
      key: "v",
      code: "KeyV",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    assert.equal(shouldAllowNativeFieldClipboard(e, fakeTextarea()), true);
    assert.equal(shouldAllowNativeFieldClipboard(e, null), false);
  });

  it("yields Cmd+A and arrow keys when activeElement is an inspector input", () => {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    const prevActive = document.activeElement;
    document.body.appendChild(input);

    try {
      input.focus();
      assert.equal(resolveKeyboardFieldTarget(null), input);

      const selectAll = {
        key: "a",
        code: "KeyA",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent;
      assert.equal(shouldYieldShortcutsToTyping(selectAll, null), true);
      assert.equal(shouldAllowNativeFieldClipboard(selectAll, null), true);

      const arrowDown = {
        key: "ArrowDown",
        code: "ArrowDown",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent;
      assert.equal(shouldYieldShortcutsToTyping(arrowDown, null), true);
    } finally {
      if (prevActive instanceof HTMLElement) prevActive.focus();
      else input.blur();
      input.remove();
    }
  });
});
