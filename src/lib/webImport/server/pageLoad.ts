import type { Page } from "playwright";
import { IMPORT_WEB_LIMITS } from "@/lib/webImport/types";

const POST_LOAD_SETTLE_MS = 2_500;
const LOAD_STATE_TIMEOUT_MS = 15_000;

/**
 * Loads a page for import without waiting for `networkidle`.
 * Heavy sites (analytics, polling) rarely reach network idle and would time out.
 */
export async function loadPageForImport(
  page: Page,
  opts: { url: string } | { html: string },
): Promise<void> {
  const timeout = IMPORT_WEB_LIMITS.navigationTimeoutMs;

  if ("url" in opts) {
    try {
      await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout });
    } catch (err) {
      const hasContent = await pageHasRenderableContent(page);
      if (!hasContent) throw formatLoadError(err, opts.url);
    }
    await page.waitForLoadState("load", { timeout: LOAD_STATE_TIMEOUT_MS }).catch(() => undefined);
  } else {
    await page.setContent(opts.html, { waitUntil: "domcontentloaded", timeout });
    await page.waitForLoadState("load", { timeout: LOAD_STATE_TIMEOUT_MS }).catch(() => undefined);
  }

  await settlePage(page, POST_LOAD_SETTLE_MS);
}

async function pageHasRenderableContent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const body = document.body;
    if (!body) return false;
    return body.childElementCount > 0 || (body.textContent?.trim().length ?? 0) > 0;
  });
}

async function settlePage(page: Page, maxMs: number): Promise<void> {
  await page.evaluate(async (waitMs) => {
    if (document.readyState !== "complete") {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        window.addEventListener("load", done, { once: true });
        window.setTimeout(done, waitMs);
      });
    }
    await new Promise((r) => window.setTimeout(r, Math.min(waitMs, 3000)));
  }, maxMs);
}

function formatLoadError(err: unknown, url: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("Timeout") || raw.includes("timeout")) {
    return new Error(
      `Timed out loading ${url}. The site may block automated browsers or load very slowly. Try again, paste raw HTML, or use Screenshot Only mode.`,
    );
  }
  return err instanceof Error ? err : new Error(raw);
}
