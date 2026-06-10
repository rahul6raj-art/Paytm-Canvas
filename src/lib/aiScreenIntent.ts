import { isRichMobileHomeIntent } from "@/lib/aiDesignTokens";
import type { AIRoutedFlow } from "@/lib/aiMockGenerator";

export type ScreenIntent =
  | "mobile_home"
  | "auth"
  | "checkout"
  | "dashboard"
  | "landing"
  | "profile"
  | "recharge"
  | "send_money"
  | "transactions"
  | "generic_mobile";

const PRESET_INTENT: Record<string, ScreenIntent> = {
  checkout: "checkout",
  profile: "profile",
  dashboard: "dashboard",
  "landing page": "landing",
  settings: "profile",
};

function intentFromImageNames(contextPrompt?: string): ScreenIntent | null {
  if (!contextPrompt?.trim()) return null;
  const names = [...contextPrompt.matchAll(/\[Image:\s*([^\]]+)\]/gi)].map((m) => m[1]!.toLowerCase());
  for (const raw of names) {
    const n = raw.replace(/^image:\s*/i, "").trim();
    if (/(checkout|payment|cart|order|pay-?now|paytm-pay)/.test(n)) return "checkout";
    if (/(profile|account|settings|my-?account)/.test(n)) return "profile";
    if (/(login|sign-?in|signup|auth|otp|onboard)/.test(n)) return "auth";
    if (/(recharge|bill-?pay|dth|fastag)/.test(n)) return "recharge";
    if (/(passbook|transaction|history|statement)/.test(n)) return "transactions";
    if (/(send-?money|transfer|upi-send)/.test(n)) return "send_money";
    if (/(home(?!page)|main-?screen|dashboard-home)/.test(n) && !/(checkout|payment)/.test(n)) {
      return "mobile_home";
    }
  }
  return null;
}

/** Explicit screen type in the user prompt beats the Screen preset dropdown. */
function detectExplicitIntentFromPrompt(prompt: string): ScreenIntent | null {
  const t = prompt.toLowerCase();

  if (isRichMobileHomeIntent(prompt)) return "mobile_home";
  if (/(login|sign\s*up|signup|sign-in|signin|onboarding|otp|verify|2fa|passcode)/.test(t)) return "auth";
  if (/(dashboard|analytics|metrics|kpi|chart|report|admin panel)/.test(t)) return "dashboard";
  if (
    /(checkout|check out|cart|order summary|payment screen|pay screen|confirm payment|payment success|post.?payment|pay now)/.test(
      t,
    )
  ) {
    return "checkout";
  }
  if (/(landing|website|hero section|marketing page|saas|pricing page)/.test(t)) return "landing";
  if (/(profile|settings|account|preferences|edit profile|my account|notification settings)/.test(t)) return "profile";
  if (/(send money|money transfer|transfer money|transfer to|pay to contact)/.test(t)) return "send_money";
  if (/(transaction history|passbook|payment history|recent payments|statement)/.test(t)) return "transactions";
  if (/(recharge screen|bill pay screen|bill payment screen|dth recharge|electricity bill|fastag|metro card)/.test(t)) {
    return "recharge";
  }

  return null;
}

/** Classify screen from user prompt, attachments, and Screen preset. */
export function detectScreenIntent(prompt: string, preset?: string, contextPrompt?: string): ScreenIntent {
  const explicit = detectExplicitIntentFromPrompt(prompt);
  if (explicit && explicit !== "mobile_home") return explicit;

  const fromImage = intentFromImageNames(contextPrompt);
  if (fromImage && fromImage !== "mobile_home") return fromImage;

  if (explicit) return explicit;
  if (fromImage) return fromImage;

  const presetKey = (preset ?? "").trim().toLowerCase();
  const presetIntent = PRESET_INTENT[presetKey];
  if (presetIntent) return presetIntent;

  const t = `${prompt}`.toLowerCase();

  if (/(login|sign\s*up|signup|sign-in|signin|onboarding|otp|verify|2fa|passcode)/.test(t)) {
    return "auth";
  }
  if (/(dashboard|analytics|metrics|kpi|chart|report|admin panel)/.test(t)) {
    return "dashboard";
  }
  if (
    /(checkout|check out|cart|order summary|payment screen|pay screen|confirm payment|payment success|post.?payment|pay now)/.test(
      t,
    )
  ) {
    return "checkout";
  }
  if (/(landing|website|hero section|marketing page|saas|pricing page)/.test(t)) {
    return "landing";
  }
  if (/(profile|settings|account|preferences|edit profile|my account|notification settings)/.test(t)) {
    return "profile";
  }
  if (/(send money|money transfer|transfer money|transfer to|pay to contact)/.test(t)) {
    return "send_money";
  }
  if (/(transaction history|passbook|payment history|recent payments|statement)/.test(t)) {
    return "transactions";
  }
  if (/(recharge|bill pay|bill payment|dth|electricity bill|fastag|metro card)/.test(t)) {
    const multiFeatureApp = /(quick action|scan and pay|bottom nav|upi balance|financial service|home screen|super.?app)/.test(
      t,
    );
    if (!multiFeatureApp) return "recharge";
  }

  if (isRichMobileHomeIntent(prompt)) {
    return "mobile_home";
  }

  return "generic_mobile";
}

export function screenIntentLabel(intent: ScreenIntent): string {
  switch (intent) {
    case "mobile_home":
      return "Mobile home";
    case "auth":
      return "Auth / onboarding";
    case "checkout":
      return "Checkout / payment";
    case "dashboard":
      return "Dashboard";
    case "landing":
      return "Landing page";
    case "profile":
      return "Profile / settings";
    case "recharge":
      return "Recharge & bills";
    case "send_money":
      return "Send money";
    case "transactions":
      return "Transactions";
    default:
      return "Mobile screen";
  }
}

/** Map detected intent to the local template router (never uses design.md text). */
export function intentToRoutedFlow(intent: ScreenIntent, prompt: string, preset?: string): AIRoutedFlow {
  switch (intent) {
    case "auth":
      return "auth";
    case "checkout":
    case "send_money":
      return "checkout";
    case "dashboard":
      return "dashboard";
    case "landing":
      return "landing";
    case "profile":
    case "transactions":
      return "profile";
    case "recharge":
      return "checkout";
    case "mobile_home":
      return "mobile";
    default:
      return routeFlowFromUserPrompt(prompt, preset);
  }
}

/** Route from user prompt only — design.md context must not pick the template. */
export function routeFlowFromUserPrompt(prompt: string, preset?: string): AIRoutedFlow {
  const t = `${prompt}\n${preset ?? ""}`.toLowerCase();
  if (/(login|sign\s*up|signup|sign-in|signin|onboarding|otp|verify)/.test(t)) return "auth";
  if (/(dashboard|analytics|metrics|kpi|chart|report)/.test(t)) return "dashboard";
  if (/(checkout|cart|order summary|payment screen|confirm payment|send money|transfer)/.test(t)) {
    return "checkout";
  }
  if (/(landing|website|hero|marketing|saas)/.test(t)) return "landing";
  if (/(settings|profile|account|preferences|transaction history|passbook)/.test(t)) return "profile";
  if (/(mobile|ios|android|app screen)/.test(t)) return "mobile";
  return "mobile";
}

export function extractScreenTitle(prompt: string, intent: ScreenIntent): string {
  const quoted = prompt.match(/(?:title|screen name|called|named)[:\s]+["']([^"']{2,48})["']/i);
  if (quoted?.[1]) return quoted[1].trim();

  const design = prompt.match(
    /(?:design|create|build|make)\s+(?:a\s+)?(?:modern\s+)?(.{4,40}?)\s+(?:screen|page|flow|view)/i,
  );
  if (design?.[1]) {
    const raw = design[1].replace(/\b(mobile|app|paytm|for)\b/gi, "").trim();
    if (raw.length >= 3) {
      return raw
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  switch (intent) {
    case "checkout":
      return /paytm/i.test(prompt) ? "Paytm Checkout" : "Checkout";
    case "profile":
      return /paytm/i.test(prompt) ? "Paytm Profile" : "Profile";
    case "auth":
      return /paytm/i.test(prompt) ? "Paytm Sign In" : "Sign In";
    case "dashboard":
      return "Dashboard";
    case "landing":
      return "Landing Page";
    case "recharge":
      return /paytm/i.test(prompt) ? "Paytm Recharge" : "Recharge";
    case "send_money":
      return /paytm/i.test(prompt) ? "Paytm Send Money" : "Send Money";
    case "transactions":
      return /paytm/i.test(prompt) ? "Paytm Passbook" : "Transactions";
    case "mobile_home":
      return /paytm/i.test(prompt) ? "Paytm Home" : "Home";
    default:
      return /paytm/i.test(prompt) ? "Paytm Screen" : "Mobile Screen";
  }
}
