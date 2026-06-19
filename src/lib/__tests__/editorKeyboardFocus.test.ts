import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCanvasTextEditFieldElement,
  isPageNameEditActive,
  isPageNameEditFieldElement,
  isToolShortcutEvent,
  isShortcutOverlayOpen,
  resolveKeyboardFieldTarget,
  shouldAllowNativeFieldClipboard,
  shouldBlockDeleteSelectionShortcut,
  shouldBlockToolShortcutsForTyping,
  shouldYieldShortcutsToTyping,
  resolveToolFromKeyboardEvent,
  releaseFieldFocusForCanvas,
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
    assert.equal(shouldBlockDeleteSelectionShortcut(e, fakeTextarea()), true);
  });

  it("yields tool shortcut letters while renaming a canvas page", () => {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    input.setAttribute("data-page-name-editor", "");
    document.body.appendChild(input);
    input.focus();

    try {
      const e = {
        key: "f",
        code: "KeyF",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent;
      assert.equal(isToolShortcutEvent(e), true);
      assert.equal(shouldYieldShortcutsToTyping(e, input), true);
    } finally {
      input.remove();
    }
  });

  it("does not blur page name editor in releaseFieldFocusForCanvas", () => {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    input.setAttribute("data-page-name-editor", "");
    document.body.appendChild(input);
    input.focus();

    try {
      assert.equal(isPageNameEditFieldElement(input), true);
      releaseFieldFocusForCanvas();
      assert.equal(document.activeElement, input);
    } finally {
      input.remove();
    }
  });

  it("treats mounted page name input as an active rename session even when canvas is focused", () => {
    if (typeof document === "undefined") return;

    const canvas = document.createElement("div");
    canvas.tabIndex = 0;
    const input = document.createElement("input");
    input.setAttribute("data-page-name-editor", "");
    document.body.appendChild(canvas);
    document.body.appendChild(input);

    try {
      canvas.focus();
      assert.equal(isPageNameEditActive(), true);
      const e = {
        key: "h",
        code: "KeyH",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent;
      assert.equal(shouldYieldShortcutsToTyping(e, canvas), true);
    } finally {
      canvas.remove();
      input.remove();
    }
  });

  it("yields tool shortcut letters in left sidebar search input", () => {
    if (typeof document === "undefined") return;

    const aside = document.createElement("aside");
    aside.setAttribute("data-left-sidebar", "");
    const input = document.createElement("input");
    aside.appendChild(input);
    document.body.appendChild(aside);

    try {
      const e = {
        key: "f",
        code: "KeyF",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent;
      assert.equal(shouldYieldShortcutsToTyping(e, input), true);
      assert.equal(shouldBlockToolShortcutsForTyping(input), true);
    } finally {
      aside.remove();
    }
  });

  it("yields tool shortcut letters in marked sidebar typing fields outside aside", () => {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    input.setAttribute("data-sidebar-typing-field", "");
    const e = {
      key: "t",
      code: "KeyT",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    assert.equal(shouldBlockToolShortcutsForTyping(input), true);
    assert.equal(shouldYieldShortcutsToTyping(e, input), true);
  });

  it("yields tool shortcut letters in multiline sidebar prompt textarea", () => {
    const e = {
      key: "t",
      code: "KeyT",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    assert.equal(isToolShortcutEvent(e), true);
    assert.equal(shouldYieldShortcutsToTyping(e, fakeTextarea()), true);
    assert.equal(shouldBlockToolShortcutsForTyping(fakeTextarea()), true);
  });

  it("applies tool shortcut letters even when an inspector input retains focus", () => {
    const e = {
      key: "f",
      code: "KeyF",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    assert.equal(isToolShortcutEvent(e), true);
    assert.equal(shouldYieldShortcutsToTyping(e, fakeInput()), false);
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

  it("allows arrow nudge when a single-line inspector input is empty", () => {
    const e = {
      key: "ArrowDown",
      code: "ArrowDown",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    const input = { tagName: "INPUT", value: "", isContentEditable: false };
    assert.equal(shouldYieldShortcutsToTyping(e, input), false);
  });

  it("yields Enter in single-line inspector inputs", () => {
    const e = {
      key: "Enter",
      code: "Enter",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    assert.equal(shouldYieldShortcutsToTyping(e, fakeInput()), true);
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

  it("treats dashboard import overlays as shortcut blockers", () => {
    assert.equal(
      isShortcutOverlayOpen({
        shortcutOverlayOpen: false,
        commandMenuOpen: false,
        aiModalOpen: false,
        pluginMarketplaceOpen: false,
        activePluginId: undefined,
        shareModalOpen: false,
        workspacePickerOpen: false,
        teamInviteModalOpen: false,
        codeRoundTripOpen: false,
        importHubOpen: true,
        importWebModalOpen: false,
        importFigmaModalOpen: false,
        prototypePreview: null,
      } as never),
      true,
    );
  });

  it("does not blur canvas text edit textarea in releaseFieldFocusForCanvas", () => {
    if (typeof document === "undefined") return;

    const textarea = document.createElement("textarea");
    textarea.setAttribute("data-text-editor", "text-1");
    document.body.appendChild(textarea);
    textarea.focus();

    try {
      assert.equal(isCanvasTextEditFieldElement(textarea), true);
      releaseFieldFocusForCanvas();
      assert.equal(document.activeElement, textarea);
    } finally {
      textarea.remove();
    }
  });
});
