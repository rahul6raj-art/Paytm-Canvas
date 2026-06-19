import type { Page } from "playwright";

/** Wait for lazy Icon() components to render SVG paths (Playwright-side, survives soft navigations). */
async function waitForLazyIcons(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const wraps = document.querySelectorAll("[class*='__icon-wrap']");
        if (wraps.length === 0) return true;
        return Array.from(wraps).every((w) =>
          w.querySelector("svg path, svg line, svg polyline, svg rect, svg circle"),
        );
      },
      { timeout: 12_000 },
    )
    .catch(() => undefined);
}

const PAINT_SELECTOR = "path,rect,circle,ellipse,line,polyline,polygon,text";

/**
 * Inline computed SVG paints on live DOM nodes so vector import gets resolved
 * colors (currentColor, CSS variables), strokes, and fill-rules — not PNGs.
 */
async function prepareSvgGraphics(page: Page): Promise<void> {
  await page.evaluate(
    ({ paintSelector }: { paintSelector: string }) => {
      function inlineSvgPaints(svg: SVGSVGElement): void {
        const svgColor = getComputedStyle(svg).color;
        const w = svg.getAttribute("width");
        const h = svg.getAttribute("height");
        const vb = svg.getAttribute("viewBox");
        if (w) svg.setAttribute("width", w);
        if (h) svg.setAttribute("height", h);
        if (vb) svg.setAttribute("viewBox", vb);

        for (const node of svg.querySelectorAll<SVGElement>(paintSelector)) {
          const cs = getComputedStyle(node);
          const fillAttr = node.getAttribute("fill");
          if (cs.fill && cs.fill !== "none") {
            node.setAttribute("fill", cs.fill);
          } else if (fillAttr === "currentColor" && svgColor) {
            node.setAttribute("fill", svgColor);
          } else if (fillAttr === "none" || cs.fill === "none") {
            node.setAttribute("fill", "none");
          }

          const strokeAttr = node.getAttribute("stroke");
          if (cs.stroke && cs.stroke !== "none") {
            node.setAttribute("stroke", cs.stroke);
            if (cs.strokeWidth) node.setAttribute("stroke-width", cs.strokeWidth);
            if (cs.strokeLinecap && cs.strokeLinecap !== "butt") {
              node.setAttribute("stroke-linecap", cs.strokeLinecap);
            }
            if (cs.strokeLinejoin && cs.strokeLinejoin !== "miter") {
              node.setAttribute("stroke-linejoin", cs.strokeLinejoin);
            }
          } else if (strokeAttr === "currentColor" && svgColor) {
            node.setAttribute("stroke", svgColor);
          } else {
            node.setAttribute("stroke", "none");
            node.removeAttribute("stroke-width");
          }

          const fillRule =
            node.getAttribute("fill-rule") ??
            node.getAttribute("fillRule") ??
            cs.getPropertyValue("fill-rule");
          if (fillRule) node.setAttribute("fill-rule", fillRule);

          const clipRule =
            node.getAttribute("clip-rule") ??
            node.getAttribute("clipRule") ??
            cs.getPropertyValue("clip-rule");
          if (clipRule) node.setAttribute("clip-rule", clipRule);

          if (cs.opacity && cs.opacity !== "1") {
            node.setAttribute("opacity", cs.opacity);
          }
        }
      }

      for (const svg of Array.from(document.querySelectorAll("svg"))) {
        inlineSvgPaints(svg);
      }
    },
    { paintSelector: PAINT_SELECTOR },
  );
}

async function runWithNavigationRetry(page: Page, fn: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await fn();
      return;
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
}

/** Expand inner scroll regions so below-the-fold phone-shell content is laid out for extract. */
async function expandScrollRegionsForCapture(page: Page): Promise<void> {
  await page.evaluate(`() => {
    const scrollSelectors = [
      ".pml-home__scroll",
      ".pml-more__scroll",
      ".pml-stocks__scroll",
      "[class*='__scroll']",
    ];
    for (const sel of scrollSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const node = el;
        node.style.overflow = "visible";
        node.style.overflowY = "visible";
        node.style.height = node.scrollHeight + "px";
        node.style.maxHeight = "none";
      });
    }
    document.querySelectorAll(".pml-home, .pml-more, .pml-stocks, .pml-signup, .pml-onboarding").forEach((el) => {
      el.style.overflow = "visible";
      el.style.height = "auto";
      el.style.maxHeight = "none";
    });
  }`);
}

/** Expand scroll regions before DOM extract so the full page is captured, not just the viewport. */
export async function prepareDomForImportExtract(page: Page): Promise<void> {
  await runWithNavigationRetry(page, async () => {
    await waitForLazyIcons(page);
    await expandScrollRegionsForCapture(page);
    await prepareSvgGraphics(page);
  });
}
