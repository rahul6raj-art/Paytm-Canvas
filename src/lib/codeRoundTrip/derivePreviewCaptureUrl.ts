import {
  applyCaptureThemeToUrl,
  resolveBridgeImportColorTheme,
} from "@/lib/webImport/captureTheme";
import {
  pageComponentLabel,
  SCREEN_ROUTE_BY_COMPONENT,
  shouldPreservePreviewCaptureUrl,
  shouldPreservePreviewScreenParam,
  isRouteSpecificPreviewUrl,
} from "@/lib/codeRoundTrip/previewCaptureRoute";

/** Default Vite/dev preview when craft.link.json omits previewUrl. Override via CRAFT_BRIDGE_PREVIEW_URL. */
export const DEFAULT_PREVIEW_BASE_URL =
  (typeof process !== "undefined" && process.env.CRAFT_BRIDGE_PREVIEW_URL?.trim()) ||
  "http://localhost:5173";

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

  if (shouldPreservePreviewCaptureUrl(parsed.toString(), pageLabel)) {
    return applyCaptureThemeToUrl(parsed.toString(), theme);
  }

  const existingScreen = parsed.searchParams.get("screen")?.trim() ?? "";
  const label = pageComponentLabel(pageLabel);
  const screenFromPage = label ? SCREEN_ROUTE_BY_COMPONENT[label] : undefined;

  if (screenFromPage && existingScreen && shouldPreservePreviewScreenParam(pageLabel, existingScreen)) {
    return applyCaptureThemeToUrl(parsed.toString(), theme);
  }

  if (screenFromPage) {
    if (screenFromPage === "home") {
      parsed.searchParams.delete("screen");
    } else {
      parsed.searchParams.set("screen", screenFromPage);
    }
    return applyCaptureThemeToUrl(parsed.toString(), theme);
  }

  if (isRouteSpecificPreviewUrl(parsed.toString())) {
    return applyCaptureThemeToUrl(parsed.toString(), theme);
  }

  return applyCaptureThemeToUrl(parsed.toString(), theme);
}
