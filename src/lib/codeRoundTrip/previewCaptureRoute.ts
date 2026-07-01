/** Screens served by the same page component (e.g. PMLHomePage handles home, mf, fno). */
export const MULTI_ROUTE_SCREENS_BY_COMPONENT: Record<string, readonly string[]> = {
  PMLHomePage: ["home", "mf", "fno"],
};

export const SCREEN_ROUTE_BY_COMPONENT: Record<string, string> = {
  PMLSignupPage: "signup",
  PMLHomePage: "home",
  PMLStocksPage: "stocks",
  PMLMorePage: "more",
  OnboardingFlow: "onboarding",
};

const ROUTE_SPECIFIC_QUERY_PARAMS = ["step", "homeTab", "tab"] as const;

/** True when the preview URL already identifies a sub-screen (tab, onboarding step, internal path). */
export function isRouteSpecificPreviewUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (parsed.pathname !== "/" && parsed.pathname !== "") return true;
    for (const key of ROUTE_SPECIFIC_QUERY_PARAMS) {
      if (parsed.searchParams.has(key)) return true;
    }
    const screen = parsed.searchParams.get("screen")?.trim();
    return !!screen && screen !== "home";
  } catch {
    return false;
  }
}

/** Keep live capture URL as-is when it already targets a specific on-screen route. */
export function shouldPreservePreviewCaptureUrl(
  url: string,
  pageLabel?: string,
): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);

    for (const key of ROUTE_SPECIFIC_QUERY_PARAMS) {
      if (parsed.searchParams.has(key)) return true;
    }
    if (parsed.pathname !== "/" && parsed.pathname !== "") return true;

    const existingScreen = parsed.searchParams.get("screen")?.trim() ?? "";
    if (!existingScreen) return false;

    if (shouldPreservePreviewScreenParam(pageLabel, existingScreen)) {
      return true;
    }

    const label = pageComponentLabel(pageLabel);
    const mappedScreen = label ? SCREEN_ROUTE_BY_COMPONENT[label] : undefined;
    if (mappedScreen && existingScreen === mappedScreen) return true;
    if (!pageLabel?.trim()) return existingScreen !== "home";

    return false;
  } catch {
    return false;
  }
}

export function pageComponentLabel(pageLabel?: string): string {
  return (pageLabel ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/\/$/, "")
    .split("/")
    .pop() ?? "";
}

export function shouldPreservePreviewScreenParam(
  pageLabel: string | undefined,
  existingScreen: string,
): boolean {
  const component = pageComponentLabel(pageLabel);
  if (!component) return false;
  const routes = MULTI_ROUTE_SCREENS_BY_COMPONENT[component];
  return routes?.includes(existingScreen) ?? false;
}

export function slugPreviewTabLabel(text: string): string {
  return text
    .replace(/\d+/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
