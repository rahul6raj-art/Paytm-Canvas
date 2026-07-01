import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWebImportedTextNode } from "@/lib/webImport/webImportNodeIdentity";

describe("webImportNodeIdentity", () => {
  it("identifies bridge capture text nodes", () => {
    assert.equal(isWebImportedTextNode({ id: "web-42", type: "text" }), true);
    assert.equal(isWebImportedTextNode({ id: "frame-1", type: "text" }), false);
    assert.equal(isWebImportedTextNode({ id: "web-1", type: "frame" }), false);
  });
});
