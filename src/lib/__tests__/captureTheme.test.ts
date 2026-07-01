import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyCaptureThemeToUrl,
  resolveBridgeImportColorTheme,
  syncCaptureThemeToUrl,
} from "@/lib/webImport/captureTheme";

describe("captureTheme", () => {
  const prev = process.env.CRAFT_BRIDGE_CAPTURE_THEME;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRAFT_BRIDGE_CAPTURE_THEME;
    else process.env.CRAFT_BRIDGE_CAPTURE_THEME = prev;
  });

  it("resolveBridgeImportColorTheme prefers explicit theme, then URL, then env", () => {
    process.env.CRAFT_BRIDGE_CAPTURE_THEME = "light";
    assert.equal(resolveBridgeImportColorTheme("http://localhost:5173?theme=dark"), "dark");
    assert.equal(resolveBridgeImportColorTheme("http://localhost:5173?theme=dark", "light"), "light");
    assert.equal(resolveBridgeImportColorTheme("http://localhost:5173"), "light");
    process.env.CRAFT_BRIDGE_CAPTURE_THEME = "dark";
    assert.equal(resolveBridgeImportColorTheme("http://localhost:5173"), "dark");
  });

  it("syncCaptureThemeToUrl preserves dark mode from preview URL", () => {
    const { url, theme } = syncCaptureThemeToUrl("http://localhost:5173/?screen=more&theme=dark");
    assert.equal(theme, "dark");
    assert.match(url, /theme=dark/);
  });

  it("applyCaptureThemeToUrl sets theme param on capture URL", () => {
    const url = applyCaptureThemeToUrl("http://localhost:5173?theme=dark", "light");
    assert.match(url, /theme=light/);
    assert.doesNotMatch(url, /theme=dark/);
  });
});
