import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveEditorHintVisible } from "../editorHintPolicy";

describe("resolveEditorHintVisible", () => {
  it("hides all hints when policy is none", () => {
    assert.equal(
      resolveEditorHintVisible({ policy: "none", shortcut: "V" }),
      false,
    );
    assert.equal(
      resolveEditorHintVisible({ policy: "none", priority: "always" }),
      true,
    );
  });

  it("shows only shortcut hints when policy is shortcuts-only", () => {
    assert.equal(
      resolveEditorHintVisible({ policy: "shortcuts-only", shortcut: "V" }),
      true,
    );
    assert.equal(
      resolveEditorHintVisible({ policy: "shortcuts-only", shortcut: "" }),
      false,
    );
    assert.equal(
      resolveEditorHintVisible({ policy: "shortcuts-only" }),
      false,
    );
  });

  it("shows all hints when policy is full", () => {
    assert.equal(resolveEditorHintVisible({ policy: "full" }), true);
  });

  it("respects explicit never priority", () => {
    assert.equal(
      resolveEditorHintVisible({ policy: "full", priority: "never", shortcut: "V" }),
      false,
    );
  });
});
