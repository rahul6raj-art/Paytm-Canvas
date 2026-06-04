import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { didPointerExitElement } from "@/lib/domPointer";

describe("didPointerExitElement", () => {
  it("returns true when relatedTarget is not a DOM Node", () => {
    const parent = { contains: () => false };
    const fakeTarget = { nodeType: 0 } as EventTarget;
    assert.equal(didPointerExitElement(parent as EventTarget, fakeTarget), true);
  });

  it("returns false when relatedTarget is a child element", () => {
    if (typeof document === "undefined") return;
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);
    assert.equal(didPointerExitElement(parent, child), false);
  });

  it("returns true when relatedTarget is null", () => {
    if (typeof document === "undefined") return;
    const parent = document.createElement("div");
    assert.equal(didPointerExitElement(parent, null), true);
  });
});
