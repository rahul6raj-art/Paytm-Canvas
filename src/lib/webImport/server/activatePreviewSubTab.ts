import type { Page } from "playwright";
import { slugPreviewTabLabel } from "@/lib/codeRoundTrip/previewCaptureRoute";

const HOME_HEADER_TABS = new Set(["portfolio", "ipos", "nfo", "mtf"]);

/** Visible copy that confirms an onboarding step loaded (subset — extend as needed). */
const ONBOARDING_STEP_MARKERS: Record<string, string> = {
  welcome: "Invest in Stocks with Expert Advice",
  mobile: "Enter mobile number",
  otp: "Enter OTP",
  "add-email": "Add email",
  "enter-email": "Enter your email",
  "confirm-pan": "Confirm PAN details",
  "tell-us-more": "Tell us more about you",
  signature: "Add signature",
  "signature-draw": "Draw your signature",
  "sig-draw": "Draw your signature",
  "verify-address": "Verify address via Aadhaar",
  "setup-pin": "Set up PIN",
  "enable-biometric": "Enable biometric login",
};

function readHomeTabParam(url: string): string | null {
  try {
    const parsed = new URL(url);
    const homeTab = parsed.searchParams.get("homeTab")?.trim().toLowerCase();
    if (homeTab && HOME_HEADER_TABS.has(homeTab)) return homeTab;
    const tab = parsed.searchParams.get("tab")?.trim().toLowerCase();
    if (tab && HOME_HEADER_TABS.has(tab)) return tab;
    return null;
  } catch {
    return null;
  }
}

function readOnboardingStepParam(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("screen")?.trim() !== "onboarding") return null;
    return parsed.searchParams.get("step")?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

async function activateHomeSubTab(page: Page, tab: string): Promise<void> {
  await page.evaluate(
    `(tabId) => {
      const normalized = tabId.toLowerCase();
      const byData =
        document.querySelector('[data-craft-tab="' + tabId + '"]') ||
        document.querySelector('[data-tab="' + tabId + '"]');
      if (byData instanceof HTMLElement) {
        byData.click();
        return;
      }
      const slug = (text) =>
        String(text || "")
          .replace(/\\d+/g, "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      const tabs = Array.from(
        document.querySelectorAll(
          '.tab--active[role="tab"], [role="tab"], .tab[role="tab"], [data-craft-tab], button.tab',
        ),
      );
      const match = tabs.find((el) => {
        const label = slug(el.textContent || "");
        return (
          label === normalized ||
          label.startsWith(normalized) ||
          normalized.startsWith(label)
        );
      });
      if (match instanceof HTMLElement) match.click();
    }`,
    tab,
  );

  if (tab === "ipos") {
    await page.getByText("Open IPOs").first().waitFor({ timeout: 8_000 }).catch(() => undefined);
  } else if (tab === "portfolio") {
    await page
      .getByText("Total portfolio value")
      .first()
      .waitFor({ timeout: 8_000 })
      .catch(() => undefined);
  } else {
    await page.waitForTimeout(700);
  }
}

async function waitForOnboardingStep(page: Page, step: string): Promise<void> {
  const marker = ONBOARDING_STEP_MARKERS[step];
  if (marker) {
    await page.getByText(marker).first().waitFor({ timeout: 10_000 }).catch(() => undefined);
    return;
  }
  await page.waitForTimeout(900);
}

async function onboardingStepIsVisible(page: Page, step: string): Promise<boolean> {
  const marker = ONBOARDING_STEP_MARKERS[step];
  if (!marker) return false;
  return page
    .getByText(marker)
    .first()
    .isVisible()
    .catch(() => false);
}

async function activateOnboardingStep(page: Page, step: string, url: string): Promise<void> {
  if (await onboardingStepIsVisible(page, step)) return;

  await page.evaluate(
    `(stepId) => {
      const hook =
        document.querySelector('[data-craft-onboarding-step="' + stepId + '"]') ||
        document.querySelector('[data-onboarding-step="' + stepId + '"]');
      if (hook instanceof HTMLElement) {
        hook.click();
        return;
      }
      const current = document.querySelector("[data-craft-onboarding-step]");
      if (current instanceof HTMLElement) {
        current.setAttribute("data-craft-onboarding-step", stepId);
        current.click();
      }
    }`,
    step,
  );
  await page.waitForTimeout(400);
  if (await onboardingStepIsVisible(page, step)) return;

  try {
    const target = new URL(url.includes("://") ? url : `http://${url}`);
    target.searchParams.set("screen", "onboarding");
    target.searchParams.set("step", step);
    await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => undefined);
  } catch {
    /* fall through to marker wait */
  }

  await waitForOnboardingStep(page, step);
}

/** After navigation, restore in-app sub-routes from ?homeTab= / ?step= query params. */
export async function activatePreviewSubTab(page: Page, url: string): Promise<void> {
  const onboardingStep = readOnboardingStepParam(url);
  if (onboardingStep) {
    await activateOnboardingStep(page, onboardingStep, url);
    return;
  }

  const homeTab = readHomeTabParam(url);
  if (homeTab) {
    await activateHomeSubTab(page, homeTab);
  }
}

export { slugPreviewTabLabel };
