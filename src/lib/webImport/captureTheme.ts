export type CaptureColorTheme = "light" | "dark";

/** Default theme for live bridge capture. Override with CRAFT_BRIDGE_CAPTURE_THEME=light|dark. */
export function defaultCaptureColorTheme(): CaptureColorTheme {
  const raw = process.env.CRAFT_BRIDGE_CAPTURE_THEME?.trim().toLowerCase();
  if (raw === "dark") return "dark";
  return "light";
}

/**
 * Theme used for live capture and initial canvas color mode after bridge import.
 * Priority: explicit push theme → preview URL ?theme= → CRAFT_BRIDGE_CAPTURE_THEME → light.
 */
export function resolveBridgeImportColorTheme(
  previewUrl?: string,
  explicit?: CaptureColorTheme,
): CaptureColorTheme {
  if (explicit === "light" || explicit === "dark") return explicit;
  const fromUrl = previewUrl ? captureThemeFromUrl(previewUrl) : undefined;
  if (fromUrl) return fromUrl;
  const envRaw = process.env.CRAFT_BRIDGE_CAPTURE_THEME?.trim().toLowerCase();
  if (envRaw === "dark" || envRaw === "light") return envRaw;
  return "light";
}

/** Resolve theme from preview URL and ensure ?theme= matches for Playwright capture. */
export function syncCaptureThemeToUrl(
  previewUrl: string,
  explicit?: CaptureColorTheme,
): { url: string; theme: CaptureColorTheme } {
  const theme = resolveBridgeImportColorTheme(previewUrl, explicit);
  return { url: applyCaptureThemeToUrl(previewUrl, theme), theme };
}

export function captureThemeFromUrl(url: string): CaptureColorTheme | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    const raw = parsed.searchParams.get("theme")?.trim().toLowerCase();
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return undefined;
}

export function applyCaptureThemeToUrl(
  url: string,
  theme: CaptureColorTheme = defaultCaptureColorTheme(),
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    parsed.searchParams.set("theme", theme);
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/** localStorage key used by PML Vite preview for theme persistence. */
export const PML_THEME_STORAGE_KEY = "pml-theme";
