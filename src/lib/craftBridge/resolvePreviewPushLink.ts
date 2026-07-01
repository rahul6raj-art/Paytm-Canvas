import fs from "node:fs";
import path from "node:path";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import {
  discoverPreviewPagePath,
  discoverPreviewPagePathFromUrl,
  pagePathExists,
} from "@/lib/craftBridge/discoverPreviewPage";
import {
  linkPreviewUrlMatchesRoute,
  previewCaptureSourcePath,
  previewRouteKey,
} from "@/lib/craftBridge/previewRouteKey";
import {
  syncCaptureThemeToUrl,
} from "@/lib/webImport/captureTheme";

export type CraftLinkManifest = {
  craftUrl?: string;
  repoRoot?: string;
  bridgeToken?: string;
  links?: CodeRoundTripLink[];
};

const SCREEN_TO_COMPONENT: Record<string, string> = {
  home: "PMLHomePage",
  signup: "PMLSignupPage",
  stocks: "PMLStocksPage",
  more: "PMLMorePage",
  fno: "PMLHomePage",
  mf: "PMLHomePage",
  onboarding: "OnboardingFlow",
};

function linkMatchesScreen(link: CodeRoundTripLink, screen: string, component?: string): boolean {
  const sp = link.sourcePath.replace(/\\/g, "/");
  if (component && sp.includes(component)) return true;
  const slug = screen.toLowerCase();
  if (sp.toLowerCase().includes(`pml${slug}page`)) return true;
  return false;
}

function linkMatchesPreviewRoute(link: CodeRoundTripLink, previewUrl: string): boolean {
  if (!link.previewUrl?.trim()) return false;
  return linkPreviewUrlMatchesRoute(link.previewUrl, previewUrl);
}

function captureUrlForPreview(previewUrl: string): string {
  return syncCaptureThemeToUrl(previewUrl).url;
}

/** Live browser URL carries finer route detail than a generic craft.link previewUrl. */
function previewUrlIsMoreSpecificThanLink(
  currentPreviewUrl: string,
  linkPreviewUrl?: string,
): boolean {
  try {
    const current = new URL(
      currentPreviewUrl.includes("://") ? currentPreviewUrl : `http://${currentPreviewUrl}`,
    );

    for (const key of ["step", "homeTab", "tab"] as const) {
      if (!current.searchParams.has(key)) continue;
      const linkPreview = linkPreviewUrl?.trim();
      if (!linkPreview) return true;
      const link = new URL(linkPreview.includes("://") ? linkPreview : `http://${linkPreview}`);
      if (!link.searchParams.has(key)) return true;
      if (link.searchParams.get(key) !== current.searchParams.get(key)) return true;
    }

    if (current.pathname !== "/" && current.pathname !== "") {
      const linkPreview = linkPreviewUrl?.trim();
      if (!linkPreview) return true;
      const link = new URL(linkPreview.includes("://") ? linkPreview : `http://${linkPreview}`);
      if (link.pathname !== current.pathname) return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function readCraftLinkManifest(repoRoot: string): CraftLinkManifest | null {
  try {
    const raw = fs.readFileSync(path.join(path.resolve(repoRoot), "craft.link.json"), "utf8");
    return JSON.parse(raw) as CraftLinkManifest;
  } catch {
    return null;
  }
}

export function previewScreenId(previewUrl: string): string {
  try {
    const u = new URL(previewUrl);
    const screen = u.searchParams.get("screen")?.trim();
    if (screen) return screen;
    if (u.pathname && u.pathname !== "/") {
      return u.pathname.replace(/^\//, "").replace(/\//g, "-");
    }
    return "home";
  } catch {
    return "home";
  }
}

/** True when the preview URL uses PML-style ?screen= routing. */
export function previewUsesScreenParam(previewUrl: string): boolean {
  try {
    const u = new URL(previewUrl.includes("://") ? previewUrl : `http://${previewUrl}`);
    return u.searchParams.has("screen");
  } catch {
    return false;
  }
}

export type PreviewPushResolution =
  | {
      ok: true;
      mode: "linked";
      pagePath: string;
      captureUrl: string;
      link: CodeRoundTripLink;
      repoRoot: string;
    }
  | {
      ok: true;
      mode: "capture-only";
      captureUrl: string;
      repoRoot: string;
      routeKey: string;
      virtualSourcePath: string;
    }
  | { ok: false; error: string };

/** Map live preview URL to a linked page folder, or capture-only for internal/unknown routes. */
export function resolvePreviewPushLink(
  repoRoot: string,
  previewUrl: string,
): PreviewPushResolution {
  const absRepo = path.resolve(repoRoot);
  const manifest = readCraftLinkManifest(absRepo);
  const routeKey = previewRouteKey(previewUrl);
  const virtualSourcePath = previewCaptureSourcePath(previewUrl);
  const captureUrl = captureUrlForPreview(previewUrl);
  const screen = previewScreenId(previewUrl);
  const component = SCREEN_TO_COMPONENT[screen];

  const validLinks =
    manifest?.links?.filter((l) => pagePathExists(absRepo, l.sourcePath)) ?? [];

  let link = validLinks.find((l) => linkMatchesPreviewRoute(l, previewUrl));

  if (!link) {
    const discovered =
      discoverPreviewPagePathFromUrl(absRepo, previewUrl) ??
      (previewUsesScreenParam(previewUrl)
        ? discoverPreviewPagePath(absRepo, screen)
        : null);
    if (discovered) {
      link = validLinks.find((l) => l.sourcePath.replace(/\\/g, "/") === discovered) ?? {
        sourcePath: discovered,
        repoRoot: absRepo,
        previewUrl: captureUrl,
        syncMode: "manual",
        watchSource: false,
      };
    }
  }

  if (!link && previewUsesScreenParam(previewUrl)) {
    link = validLinks.find((l) => linkMatchesScreen(l, screen, component));
  }

  if (link) {
    if (previewUrlIsMoreSpecificThanLink(previewUrl, link.previewUrl)) {
      return {
        ok: true,
        mode: "capture-only",
        captureUrl,
        repoRoot: absRepo,
        routeKey,
        virtualSourcePath,
      };
    }

    const themedCaptureUrl = captureUrlForPreview(previewUrl);
    return {
      ok: true,
      mode: "linked",
      pagePath: link.sourcePath.replace(/\\/g, "/"),
      captureUrl: themedCaptureUrl,
      link: { ...link, repoRoot: absRepo, previewUrl: themedCaptureUrl },
      repoRoot: absRepo,
    };
  }

  return {
    ok: true,
    mode: "capture-only",
    captureUrl,
    repoRoot: absRepo,
    routeKey,
    virtualSourcePath,
  };
}
