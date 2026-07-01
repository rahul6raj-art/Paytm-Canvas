import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPreviewOnlySourcePath,
  isWritableLinkedSourcePath,
  previewUrlImpliesPhoneCapture,
} from "@/lib/craftBridge/bridgeCaptureContext";

describe("bridgeCaptureContext", () => {
  it("detects preview-only virtual source paths", () => {
    assert.equal(isPreviewOnlySourcePath("preview://settings/profile"), true);
    assert.equal(isWritableLinkedSourcePath("src/pages/Home.tsx"), true);
    assert.equal(isWritableLinkedSourcePath("preview://?screen=home"), false);
  });

  it("classifies preview URLs for phone vs desktop capture", () => {
    assert.equal(previewUrlImpliesPhoneCapture("http://localhost:5173/?screen=home"), true);
    assert.equal(previewUrlImpliesPhoneCapture("http://localhost:5173/dashboard"), false);
    assert.equal(
      previewUrlImpliesPhoneCapture("http://localhost:6006/iframe.html?id=foo"),
      false,
    );
  });
});
