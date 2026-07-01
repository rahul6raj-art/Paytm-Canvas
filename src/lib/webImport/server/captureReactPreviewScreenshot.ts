import type { Page } from "playwright";
import type { ImportWebScreenshot } from "@/lib/webImport/types";

const PHONE_SHELL_SELECTOR =
  ".ob-flow, .pml-home, .pml-signup, .pml-more, .pml-stocks, [data-craft-screen]";

/**
 * Screenshot the phone column element so PNG pixels align 1:1 with the focused DOM tree root.
 */
export async function captureReactPreviewScreenshot(
  page: Page,
  viewport: { width: number; height: number },
): Promise<{ buffer: Buffer; meta: ImportWebScreenshot }> {
  const shell = page.locator(PHONE_SHELL_SELECTOR).first();
  const hasShell = (await shell.count()) > 0;

  if (hasShell) {
    await shell.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
    const box = await shell.boundingBox();
    const buffer = await shell.screenshot({ type: "png", animations: "disabled" });
    return {
      buffer,
      meta: {
        dataUrl: `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`,
        width: Math.round(box?.width ?? viewport.width),
        height: Math.round(box?.height ?? viewport.height),
      },
    };
  }

  const buffer = await page.screenshot({
    type: "png",
    fullPage: true,
    animations: "disabled",
  });
  const scrollHeight = await page.evaluate(() =>
    Math.min(document.documentElement.scrollHeight, 24000),
  );
  return {
    buffer,
    meta: {
      dataUrl: `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`,
      width: viewport.width,
      height: Math.min(scrollHeight, 24000),
    },
  };
}
