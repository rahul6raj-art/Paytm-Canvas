import type { Browser, LaunchOptions } from "playwright";

const LAUNCH_ARGS = ["--disable-dev-shm-usage", "--no-sandbox"];

/** Channels to try when Playwright's bundled Chromium is not installed. */
const SYSTEM_BROWSER_CHANNELS = ["chrome", "msedge", "chrome-beta"] as const;

function isMissingBrowserError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Executable doesn't exist") ||
    msg.includes("browserType.launch") ||
    msg.includes("Failed to launch")
  );
}

export function formatBrowserLaunchError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (isMissingBrowserError(err)) {
    return [
      "No browser available for web import.",
      "",
      "Option A — install Playwright Chromium (recommended):",
      "  npm run setup:browsers",
      "",
      "Option B — use an existing browser:",
      "  Install Google Chrome or Microsoft Edge, then try again.",
      "",
      "After setup, restart the dev server and retry the import.",
    ].join("\n");
  }
  return raw.split("╔")[0]?.trim() || raw;
}

export async function launchImportBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");

  const base: LaunchOptions = {
    headless: true,
    args: LAUNCH_ARGS,
  };

  let lastError: unknown;
  try {
    return await chromium.launch(base);
  } catch (e) {
    lastError = e;
    if (!isMissingBrowserError(e)) throw e;
  }

  for (const channel of SYSTEM_BROWSER_CHANNELS) {
    try {
      return await chromium.launch({ ...base, channel });
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(formatBrowserLaunchError(lastError));
}
