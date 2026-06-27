/** Stable route identity for a live preview URL (pathname + query, theme stripped). */
export function previewRouteKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "/";
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    const params = new URLSearchParams(parsed.search);
    params.delete("theme");
    const qs = params.toString();
    const path = parsed.pathname || "/";
    return qs ? `${path}?${qs}` : path;
  } catch {
    return trimmed;
  }
}

/** Virtual craft.link source path for preview-only captures (enables replace-on-repush). */
export function previewCaptureSourcePath(url: string): string {
  const key = previewRouteKey(url).replace(/^\//, "");
  return `preview://${key || "root"}`;
}

/** Human-readable canvas label from a preview URL path or ?screen= param. */
export function canvasScreenLabelFromPreviewUrl(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `http://${url}`);
    const screen = parsed.searchParams.get("screen")?.trim();
    if (screen) {
      const words = screen
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (/^pml/i.test(screen)) return `PML- ${words.replace(/^Pml\s*/i, "")}`;
      return words;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return "Home";
    return last
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Imported screen";
  }
}

/** True when two preview URLs refer to the same on-screen route. */
export function previewUrlsMatchRoute(a: string, b: string): boolean {
  return previewRouteKey(a) === previewRouteKey(b);
}

/** Match a craft.link previewUrl field against the current browser URL. */
export function linkPreviewUrlMatchesRoute(linkPreviewUrl: string, currentPreviewUrl: string): boolean {
  const linkKey = previewRouteKey(linkPreviewUrl);
  const currentKey = previewRouteKey(currentPreviewUrl);
  if (linkKey === currentKey) return true;

  try {
    const link = new URL(linkPreviewUrl.includes("://") ? linkPreviewUrl : `http://${linkPreviewUrl}`);
    const current = new URL(
      currentPreviewUrl.includes("://") ? currentPreviewUrl : `http://${currentPreviewUrl}`,
    );
    if (link.origin !== current.origin) return false;
    if (link.pathname !== "/" && link.pathname === current.pathname) {
      const linkScreen = link.searchParams.get("screen");
      const curScreen = current.searchParams.get("screen");
      if (linkScreen && curScreen) return linkScreen === curScreen;
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
