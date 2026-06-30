import {
  applyCaptureThemeToUrl,
  resolveBridgeImportColorTheme,
} from "@/lib/webImport/captureTheme";

const SCREEN_ROUTE_BY_COMPONENT: Record<string, string> = {
  PMLSignupPage: "signup",
  PMLHomePage: "home",
  PMLStocksPage: "stocks",
  PMLMorePage: "more",
  OnboardingFlow: "onboarding",
};

/** Default Vite/dev preview when craft.link.json omits previewUrl. Override via CRAFT_BRIDGE_PREVIEW_URL. */
export const DEFAULT_PREVIEW_BASE_URL =
  (typeof process !== "undefined" && process.env.CRAFT_BRIDGE_PREVIEW_URL?.trim()) ||
  "http://localhost:5173";

function pageComponentLabel(pageLabel?: string): string {
  return (pageLabel ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/\/$/, "")
    .split("/")
    .pop() ?? "";
}

/** Resolve preview URL for bridge push — uses explicit URL or localhost default for known screens. */
export function resolvePreviewCaptureUrl(
  previewUrl: string | undefined,
  pageLabel?: string,
): string | undefined {
  const explicit = previewUrl?.trim();
  if (explicit) return derivePreviewCaptureUrl(explicit, pageLabel);
  const label = pageComponentLabel(pageLabel);
  if (!label || !SCREEN_ROUTE_BY_COMPONENT[label]) return undefined;
  return derivePreviewCaptureUrl(DEFAULT_PREVIEW_BASE_URL, pageLabel);
}

/** Append app-specific preview routes (e.g. ?screen=signup) when capture URL is bare localhost. */
export function derivePreviewCaptureUrl(previewUrl: string, pageLabel?: string): string {
  const trimmed = previewUrl.trim();
  if (!trimmed) return trimmed;

  const theme = resolveBridgeImportColorTheme(trimmed);

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
  } catch {
    return trimmed;
  }

  if (parsed.searchParams.has("screen") || parsed.pathname !== "/") {
    return applyCaptureThemeToUrl(parsed.toString(), theme);
  }

  const label = pageComponentLabel(pageLabel);
  const screen = label ? SCREEN_ROUTE_BY_COMPONENT[label] : undefined;
  if (screen && screen !== "home") {
    parsed.searchParams.set("screen", screen);
  }

  return applyCaptureThemeToUrl(parsed.toString(), theme);
}
