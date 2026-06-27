import type { Page } from "playwright";
import { IMPORT_WEB_LIMITS } from "@/lib/webImport/types";
import { prepareDomForImportExtract } from "@/lib/webImport/server/prepareDomForImportExtract";

const POST_LOAD_SETTLE_MS = 4_000;
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
    await waitForReactPreviewScreen(page, opts.url);
  } else {
    await page.setContent(opts.html, { waitUntil: "domcontentloaded", timeout });
    await page.waitForLoadState("load", { timeout: LOAD_STATE_TIMEOUT_MS }).catch(() => undefined);
  }

  await settlePage(page, POST_LOAD_SETTLE_MS);
  await prepareDomForImportExtract(page);
}

async function waitForReactPreviewScreen(page: Page, url: string): Promise<void> {
  const selectors: string[] = [
    "[data-craft-screen]",
    "#root > *",
    "main",
    "[role='main']",
    ".pml-signup",
    ".pml-home",
    ".pml-onboarding",
    "[class*='pml-']",
  ];

  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes("iframe.html")) {
      selectors.unshift(
        "#storybook-root",
        "#storybook-root > *",
        ".sb-pml-preview-canvas",
        ".sb-show-main",
        "button",
        ".btn",
        ".badge",
      );
    }
    const screen = parsed.searchParams.get("screen")?.trim();
    if (screen) {
      selectors.unshift(`.pml-${screen.replace(/[^a-z0-9-]/gi, "")}`);
    }
    if (parsed.pathname && parsed.pathname !== "/") {
      selectors.unshift(`[data-craft-route="${parsed.pathname}"]`);
    }
  } catch {
    /* use defaults */
  }

  await page
    .waitForSelector(selectors.join(", "), { timeout: 12_000 })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
}

async function pageHasRenderableContent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const body = document.body;
    if (!body) return false;
    return body.childElementCount > 0 || (body.textContent?.trim().length ?? 0) > 0;
  });
}

async function settlePage(page: Page, maxMs: number): Promise<void> {
  // Use string evaluate — tsx/esbuild inject `__name` into arrow fns which breaks in the browser.
  await page.evaluate(
    `async (waitMs) => {
      document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
        img.loading = "eager";
      });
      window.scrollTo(0, document.body.scrollHeight);
      window.scrollTo(0, 0);
      if (document.readyState !== "complete") {
        await new Promise((resolve) => {
          const done = () => resolve();
          window.addEventListener("load", done, { once: true });
          window.setTimeout(done, waitMs);
        });
      }
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready.catch(() => undefined);
      }
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.addEventListener("load", () => resolve(), { once: true });
                  img.addEventListener("error", () => resolve(), { once: true });
                }),
        ),
      );
      await new Promise((r) => window.setTimeout(r, Math.min(waitMs, 3500)));
    }`,
    maxMs,
  );
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
