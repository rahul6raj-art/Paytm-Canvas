import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyCaptureThemeToUrl,
  resolveBridgeImportColorTheme,
} from "@/lib/webImport/captureTheme";

describe("captureTheme", () => {
  const prev = process.env.CRAFT_BRIDGE_CAPTURE_THEME;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRAFT_BRIDGE_CAPTURE_THEME;
    else process.env.CRAFT_BRIDGE_CAPTURE_THEME = prev;
  });

  it("resolveBridgeImportColorTheme prefers explicit theme then env", () => {
    process.env.CRAFT_BRIDGE_CAPTURE_THEME = "dark";
    assert.equal(resolveBridgeImportColorTheme("http://localhost:5173?theme=light"), "dark");
    assert.equal(resolveBridgeImportColorTheme("http://localhost:5173?theme=light", "light"), "light");
  });

  it("applyCaptureThemeToUrl forces theme param (overrides stale dark)", () => {
    const url = applyCaptureThemeToUrl("http://localhost:5173?theme=dark", "light");
    assert.match(url, /theme=light/);
    assert.doesNotMatch(url, /theme=dark/);
  });
});
