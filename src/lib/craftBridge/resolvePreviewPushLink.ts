import fs from "node:fs";
import path from "node:path";
import { derivePreviewCaptureUrl } from "@/lib/codeRoundTrip/derivePreviewCaptureUrl";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import {
  discoverPreviewPagePath,
  pagePathExists,
} from "@/lib/craftBridge/discoverPreviewPage";
import {
  linkPreviewUrlMatchesRoute,
  previewCaptureSourcePath,
  previewRouteKey,
} from "@/lib/craftBridge/previewRouteKey";
import {
  applyCaptureThemeToUrl,
  defaultCaptureColorTheme,
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

function captureUrlForPreview(previewUrl: string, pageLabel?: string): string {
  if (pageLabel) return derivePreviewCaptureUrl(previewUrl, pageLabel);
  return applyCaptureThemeToUrl(previewUrl, defaultCaptureColorTheme());
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

/** True when ?screen= routing applies (root URL or explicit screen param). */
export function previewUsesScreenParam(previewUrl: string): boolean {
  try {
    const u = new URL(previewUrl);
    if (u.searchParams.has("screen")) return true;
    return u.pathname === "/" || u.pathname === "";
  } catch {
    return true;
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

  if (!link && previewUsesScreenParam(previewUrl)) {
    link = validLinks.find((l) => linkMatchesScreen(l, screen, component));
  }

  if (!link && previewUsesScreenParam(previewUrl)) {
    const discovered = discoverPreviewPagePath(absRepo, screen);
    if (discovered) {
      link = {
        sourcePath: discovered,
        repoRoot: absRepo,
        previewUrl:
          validLinks.find((l) => l.previewUrl)?.previewUrl ??
          manifest?.links?.find((l) => l.previewUrl)?.previewUrl,
        syncMode: "manual",
        watchSource: false,
      };
    }
  }

  if (link) {
    const pageLabel = path.basename(link.sourcePath.replace(/\\/g, "/"));
    const themedCaptureUrl = captureUrlForPreview(previewUrl, pageLabel);
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
