import type {
  DomSnapshotNode,
  ImportWebMode,
  ImportWebPageMeta,
  ImportWebRequest,
  ImportWebResponse,
  ImportWebScreenshot,
} from "@/lib/webImport/types";
import { IMPORT_WEB_LIMITS } from "@/lib/webImport/types";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import { validateImportWebUrl } from "@/lib/webImport/urlValidation";
import { focusDomTreeOnReactScreenRoot } from "@/lib/webImport/reactPreviewDomRoot";
import { focusDomTreeOnStorybookStoryRoot } from "@/lib/webImport/storybookDomRoot";
import { filterDomSnapshotTree, countDomNodes, pruneDomTreeByLimit } from "@/lib/webImport/domFilter";
import { normalizeDomSnapshot } from "@/lib/webImport/domNormalizer";
import { annotateSectionHints, detectSections } from "@/lib/webImport/sectionDetector";
import { annotateComponentHints } from "@/lib/webImport/componentDetector";
import { runDesignNativeImport } from "@/lib/webImport/pipeline";
import { inlineDomImageSources } from "@/lib/webImport/server/inlineDomImageSources";
import { launchImportBrowser } from "@/lib/webImport/server/launchPlaywrightBrowser";
import { loadPageForImport } from "@/lib/webImport/server/pageLoad";
import { loadDomExtractorBundle } from "@/lib/webImport/server/bundleDomExtractor";
import { captureReactPreviewScreenshot } from "@/lib/webImport/server/captureReactPreviewScreenshot";
import {
  applyCaptureThemeToUrl,
  resolveBridgeImportColorTheme,
  type CaptureColorTheme,
  PML_THEME_STORAGE_KEY,
} from "@/lib/webImport/captureTheme";
import type { Page } from "playwright";

/** Localhost Storybook + Vite preview captures (craft bridge). */
export function isLocalBridgeCapturePolicy(urlPolicy?: ImportWebRequest["urlPolicy"]): boolean {
  return urlPolicy === "react-preview" || urlPolicy === "storybook-iframe";
}

function parseStorybookIframeTheme(url: string): CaptureColorTheme {
  try {
    const globals = new URL(url).searchParams.get("globals") ?? "";
    if (/theme:dark\b/i.test(globals)) return "dark";
  } catch {
    /* ignore */
  }
  return "light";
}

async function extractDomTreeWithRetry(
  page: Page,
  bundleCode: string,
): Promise<DomSnapshotNode> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return (await page.evaluate((code: string) => {
        // eslint-disable-next-line no-eval
        return eval(`${code}; __craftDomExtract.extractDomTreeInBrowser()`);
      }, bundleCode)) as DomSnapshotNode;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retryable =
        msg.includes("Execution context was destroyed") ||
        msg.includes("navigation") ||
        msg.includes("Target closed");
      if (!retryable || attempt === 2) throw e;
      await page.waitForTimeout(400);
    }
  }
  throw new Error("DOM extract failed after retries.");
}

export type CaptureStep =
  | "launching"
  | "loading"
  | "screenshot"
  | "extracting"
  | "converting"
  | "building";

export async function runImportWebCapture(
  body: ImportWebRequest,
): Promise<ImportWebResponse> {
  if (!body.url?.trim() && !body.html?.trim()) {
    throw new Error("Provide a URL or raw HTML.");
  }

  const viewport = {
    width: Math.min(4096, Math.max(320, Math.round(body.viewport.width))),
    height: Math.min(4096, Math.max(480, Math.round(body.viewport.height))),
  };

  let targetUrl: string | null = null;
  if (body.url?.trim()) {
    const v = isLocalBridgeCapturePolicy(body.urlPolicy)
      ? validateReactPreviewUrl(body.url)
      : validateImportWebUrl(body.url);
    if (!v.ok) throw new Error(v.error);
    targetUrl = v.url;
  }

  const browser = await launchImportBrowser();

  const captureTheme: CaptureColorTheme = isLocalBridgeCapturePolicy(body.urlPolicy)
    ? body.urlPolicy === "storybook-iframe"
      ? parseStorybookIframeTheme(targetUrl ?? "")
      : resolveBridgeImportColorTheme(targetUrl ?? "")
    : "light";

  if (targetUrl && body.urlPolicy === "react-preview") {
    targetUrl = applyCaptureThemeToUrl(targetUrl, captureTheme);
  }

  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: false,
      acceptDownloads: false,
      colorScheme: captureTheme,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    if (isLocalBridgeCapturePolicy(body.urlPolicy)) {
      await context.addInitScript(
        ({ storageKey, theme }: { storageKey: string; theme: string }) => {
          try {
            localStorage.setItem(storageKey, theme);
          } catch {
            /* ignore */
          }
        },
        { storageKey: PML_THEME_STORAGE_KEY, theme: captureTheme },
      );
    }

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(IMPORT_WEB_LIMITS.navigationTimeoutMs);
    page.setDefaultTimeout(IMPORT_WEB_LIMITS.navigationTimeoutMs);

    if (targetUrl) {
      await loadPageForImport(page, {
        url: targetUrl,
        viewportOnlyCapture: body.bridgeViewportCapture === true,
      });
    } else {
      await loadPageForImport(page, { html: body.html! });
    }

    if (isLocalBridgeCapturePolicy(body.urlPolicy)) {
      await page
        .evaluate(
          ({ storageKey, theme }: { storageKey: string; theme: string }) => {
            try {
              localStorage.setItem(storageKey, theme);
            } catch {
              /* ignore */
            }
            document.documentElement.classList.toggle("dark", theme === "dark");
            document.documentElement.setAttribute("data-theme", theme);
            document.documentElement.setAttribute("data-craft-bridge-capture", "1");
          },
          { storageKey: PML_THEME_STORAGE_KEY, theme: captureTheme },
        )
        .catch(() => undefined);
      await page.waitForTimeout(150);
    }

    if (isLocalBridgeCapturePolicy(body.urlPolicy)) {
      await page
        .evaluate(`() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement) active.blur();
        }`)
        .catch(() => undefined);
      await page.waitForTimeout(120);
    }

    const title = await page.title();
    const scrollHeight = await page.evaluate(() =>
      Math.min(document.documentElement.scrollHeight, 24000),
    );

    let screenshot: ImportWebScreenshot | null = null;
    if (body.mode === "screenshot" || body.mode === "editable_with_reference") {
      let buf: Buffer;
      if (body.urlPolicy === "react-preview") {
        const captured = await captureReactPreviewScreenshot(page, viewport);
        buf = captured.buffer;
        screenshot = captured.meta;
      } else {
        buf = await page.screenshot({
          type: "png",
          fullPage: true,
          animations: "disabled",
        });
        screenshot = {
          dataUrl: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
          width: viewport.width,
          height: Math.min(scrollHeight, IMPORT_WEB_LIMITS.maxPageHeight),
        };
      }
      if (buf.byteLength > IMPORT_WEB_LIMITS.maxScreenshotBytes) {
        throw new Error("Screenshot exceeds maximum allowed size.");
      }
      if (!screenshot) {
        screenshot = {
          dataUrl: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
          width: viewport.width,
          height: Math.min(scrollHeight, IMPORT_WEB_LIMITS.maxPageHeight),
        };
      }
    }

    if (body.mode === "screenshot") {
      await context.close();
      const pageMeta: ImportWebPageMeta = {
        title: title || "Imported page",
        url: targetUrl,
        width: viewport.width,
        height: Math.min(scrollHeight, IMPORT_WEB_LIMITS.maxPageHeight),
      };
      return {
        page: pageMeta,
        screenshot,
        sections: [],
        scene: {
          id: "web-empty",
          type: "frame",
          name: pageMeta.title,
          x: 0,
          y: 0,
          width: pageMeta.width,
          height: pageMeta.height,
          children: [],
        },
        mode: body.mode,
        assets: {},
      };
    }

    const rawTree = (await extractDomTreeWithRetry(page, loadDomExtractorBundle())) as DomSnapshotNode;
    let tree = filterDomSnapshotTree(rawTree) ?? rawTree;
    tree = await inlineDomImageSources(tree, context.request);
    await context.close();
    tree = normalizeDomSnapshot(tree);
    if (body.urlPolicy === "storybook-iframe") {
      tree = focusDomTreeOnStorybookStoryRoot(tree);
    } else if (body.urlPolicy === "react-preview") {
      tree = focusDomTreeOnReactScreenRoot(tree, viewport, {
        viewportOnly: body.bridgeViewportCapture === true,
      });
    }
    tree = annotateSectionHints(tree);
    tree = annotateComponentHints(tree);
    if (countDomNodes(tree) > IMPORT_WEB_LIMITS.maxNodes) {
      tree = pruneDomTreeByLimit(tree, IMPORT_WEB_LIMITS.maxNodes);
    }

    const pageMeta: ImportWebPageMeta = {
      title: title || "Imported page",
      url: targetUrl,
      width: body.bridgeViewportCapture
        ? viewport.width
        : Math.round(tree.rect.width),
      height: body.bridgeViewportCapture
        ? viewport.height
        : Math.min(Math.round(tree.rect.height), IMPORT_WEB_LIMITS.maxPageHeight),
      bridgeCapture: body.bridgeViewportCapture === true,
    };

    const sections = detectSections(tree);
    const { scene, assets, fidelity } = runDesignNativeImport(tree, pageMeta);

    return {
      page: pageMeta,
      screenshot,
      sections,
      scene,
      mode: body.mode,
      assets,
      fidelity,
    };
  } finally {
    await browser.close();
  }
}
