#!/usr/bin/env node
import { launchImportBrowser } from "../src/lib/webImport/server/launchPlaywrightBrowser.ts";
import { loadPageForImport } from "../src/lib/webImport/server/pageLoad.ts";

const browser = await launchImportBrowser();
try {
  const page = await (await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })).newPage();
  await loadPageForImport(page, { url: "https://uxmagic.ai/signup" });

  const fields = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("input, label")) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const ph = el.getAttribute("placeholder") ?? "";
      const text = (el.textContent ?? "").trim().slice(0, 40);
      if (!ph && !text) continue;
      if (!/first|last|email|name/i.test(ph + text)) continue;
      out.push({
        tag: el.tagName,
        ph,
        text,
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        rect: { w: rect.width, h: rect.height, x: rect.x, y: rect.y },
        hidden: el.hasAttribute("hidden"),
        cls: (el.className ?? "").toString().slice(0, 80),
        ariaHidden: el.getAttribute("aria-hidden"),
      });
    }
    return out;
  });
  console.log(JSON.stringify(fields, null, 2));
} finally {
  await browser.close();
}
