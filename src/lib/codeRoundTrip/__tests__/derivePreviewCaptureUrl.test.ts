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

  it("overrides stale ?screen= from craft.link when pushing a different page folder", () => {
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?screen=home", "PMLMorePage"),
      "http://localhost:5173/?screen=more&theme=light",
    );
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?screen=more", "PMLHomePage"),
      "http://localhost:5173/?theme=light",
    );
  });

  it("preserves mf/fno when linked page folder is PMLHomePage", () => {
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?screen=mf&theme=light", "PMLHomePage"),
      "http://localhost:5173/?screen=mf&theme=light",
    );
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?screen=fno", "PMLHomePage"),
      "http://localhost:5173/?screen=fno&theme=light",
    );
  });

  it("preserves onboarding step and home tab sub-routes from live preview", () => {
    assert.equal(
      derivePreviewCaptureUrl(
        "http://localhost:5173/?screen=onboarding&step=mobile",
        "OnboardingFlow",
      ),
      "http://localhost:5173/?screen=onboarding&step=mobile&theme=light",
    );
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?homeTab=ipos", "PMLHomePage"),
      "http://localhost:5173/?homeTab=ipos&theme=light",
    );
    assert.equal(
      derivePreviewCaptureUrl(
        "http://localhost:5173/?screen=home&homeTab=ipos",
        "PMLHomePage",
      ),
      "http://localhost:5173/?screen=home&homeTab=ipos&theme=light",
    );
  });

  it("preserves dark theme from preview URL", () => {
    assert.equal(
      derivePreviewCaptureUrl("http://localhost:5173/?screen=more&theme=dark", "PMLMorePage"),
      "http://localhost:5173/?screen=more&theme=dark",
    );
  });

  it("defaults to localhost preview for known PML page folders", () => {
    assert.equal(
      resolvePreviewCaptureUrl(undefined, "PMLMorePage"),
      "http://localhost:5173/?screen=more&theme=light",
    );
  });
});
