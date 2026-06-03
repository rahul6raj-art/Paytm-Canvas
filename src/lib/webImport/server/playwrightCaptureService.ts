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
import { filterDomSnapshotTree, countDomNodes, pruneDomTreeByLimit } from "@/lib/webImport/domFilter";
import { normalizeDomSnapshot } from "@/lib/webImport/domNormalizer";
import { annotateSectionHints, detectSections } from "@/lib/webImport/sectionDetector";
import { annotateComponentHints } from "@/lib/webImport/componentDetector";
import { domSnapshotToScene } from "@/lib/webImport/domToCanvasConverter";
import { extractDomTreeInBrowser } from "@/lib/webImport/server/domExtractor";
import { launchImportBrowser } from "@/lib/webImport/server/launchPlaywrightBrowser";
import { loadPageForImport } from "@/lib/webImport/server/pageLoad";

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
    const v =
      body.urlPolicy === "react-preview"
        ? validateReactPreviewUrl(body.url)
        : validateImportWebUrl(body.url);
    if (!v.ok) throw new Error(v.error);
    targetUrl = v.url;
  }

  const browser = await launchImportBrowser();

  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: false,
      acceptDownloads: false,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "en-US",
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(IMPORT_WEB_LIMITS.navigationTimeoutMs);
    page.setDefaultTimeout(IMPORT_WEB_LIMITS.navigationTimeoutMs);

    if (targetUrl) {
      await loadPageForImport(page, { url: targetUrl });
    } else {
      await loadPageForImport(page, { html: body.html! });
    }

    const title = await page.title();
    const scrollHeight = await page.evaluate(() =>
      Math.min(document.documentElement.scrollHeight, 24000),
    );

    let screenshot: ImportWebScreenshot | null = null;
    if (body.mode === "screenshot" || body.mode === "editable_with_reference") {
      const buf = await page.screenshot({
        type: "png",
        fullPage: true,
        animations: "disabled",
      });
      if (buf.byteLength > IMPORT_WEB_LIMITS.maxScreenshotBytes) {
        throw new Error("Screenshot exceeds maximum allowed size.");
      }
      const dataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
      screenshot = {
        dataUrl,
        width: viewport.width,
        height: Math.min(scrollHeight, IMPORT_WEB_LIMITS.maxPageHeight),
      };
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

    const rawTree = await page.evaluate(extractDomTreeInBrowser);
    await context.close();

    let tree = filterDomSnapshotTree(rawTree) ?? rawTree;
    tree = normalizeDomSnapshot(tree);
    tree = annotateSectionHints(tree);
    tree = annotateComponentHints(tree);
    if (countDomNodes(tree) > IMPORT_WEB_LIMITS.maxNodes) {
      tree = pruneDomTreeByLimit(tree, IMPORT_WEB_LIMITS.maxNodes);
    }

    const pageMeta: ImportWebPageMeta = {
      title: title || "Imported page",
      url: targetUrl,
      width: viewport.width,
      height: Math.min(scrollHeight, IMPORT_WEB_LIMITS.maxPageHeight),
    };

    const sections = detectSections(tree);
    const { scene, assets } = domSnapshotToScene(tree, pageMeta);

    return {
      page: pageMeta,
      screenshot,
      sections,
      scene,
      mode: body.mode,
      assets,
    };
  } finally {
    await browser.close();
  }
}
