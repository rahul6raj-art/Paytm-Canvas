import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLocalBridgeCapturePolicy } from "@/lib/webImport/server/playwrightCaptureService";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import { validateImportWebUrl } from "@/lib/webImport/urlValidation";

describe("isLocalBridgeCapturePolicy", () => {
  it("allows localhost Storybook iframe URLs for bridge capture", () => {
    assert.equal(isLocalBridgeCapturePolicy("storybook-iframe"), true);
    assert.equal(isLocalBridgeCapturePolicy("react-preview"), true);
    assert.equal(isLocalBridgeCapturePolicy("public"), false);

    const url =
      "http://localhost:6006/iframe.html?id=components-button--playground&viewMode=story";
    const preview = validateReactPreviewUrl(url);
    const blocked = validateImportWebUrl(url);
    assert.equal(preview.ok, true);
    assert.equal(blocked.ok, false);
    if (isLocalBridgeCapturePolicy("storybook-iframe")) {
      assert.equal(preview.ok, true);
    }
  });
});
