import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatBrowserLaunchError } from "../server/launchPlaywrightBrowser";

describe("formatBrowserLaunchError", () => {
  it("returns setup instructions for missing executable", () => {
    const msg = formatBrowserLaunchError(
      new Error(
        "browserType.launch: Executable doesn't exist at /Users/x/ms-playwright/chromium",
      ),
    );
    assert.match(msg, /npm run setup:browsers/);
    assert.match(msg, /Google Chrome/);
  });
});
