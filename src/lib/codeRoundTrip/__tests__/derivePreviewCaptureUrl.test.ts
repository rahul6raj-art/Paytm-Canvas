import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { derivePreviewCaptureUrl, resolvePreviewCaptureUrl } from "../derivePreviewCaptureUrl";

describe("derivePreviewCaptureUrl", () => {
  it("appends ?screen=signup for PML signup pages on bare localhost", () => {
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173", "PMLSignupPage"),
      "http://localhost:5173/?screen=signup&theme=light",
    );
  });

  it("leaves URLs that already specify a screen route", () => {
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?screen=signup", "PMLSignupPage"),
      "http://localhost:5173/?screen=signup&theme=light",
    );
  });

  it("defaults to localhost preview for known PML page folders", () => {
    assert.equal(
      resolvePreviewCaptureUrl(undefined, "PMLMorePage"),
      "http://localhost:5173/?screen=more&theme=light",
    );
  });
});
