import fs from "node:fs";
import path from "node:path";
import { resolvePageSource } from "@paytm-craft/bridge";
import { derivePreviewCaptureUrl } from "@/lib/codeRoundTrip/derivePreviewCaptureUrl";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
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
};

function craftLinkPageExists(repoRoot: string, sourcePath: string): boolean {
  const abs = path.resolve(repoRoot, sourcePath);
  if (!fs.existsSync(abs)) return false;
  try {
    resolvePageSource(abs);
    return true;
  } catch {
    return false;
  }
}

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

function inferredPagePath(component: string): string {
  return `src/screens/${component}`;
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
  const captureUrl = captureUrlForPreview(previewUrl);
  const routeKey = previewRouteKey(previewUrl);
  const virtualSourcePath = previewCaptureSourcePath(previewUrl);

  if (!manifest?.links?.length) {
    return {
      ok: true,
      mode: "capture-only",
      captureUrl,
      repoRoot: absRepo,
      routeKey,
      virtualSourcePath,
    };
  }

  const screen = previewScreenId(previewUrl);
  const component = SCREEN_TO_COMPONENT[screen];
  const validLinks = manifest.links.filter((l) => craftLinkPageExists(absRepo, l.sourcePath));

  let link = validLinks.find((l) => linkMatchesPreviewRoute(l, previewUrl));

  if (!link && previewUsesScreenParam(previewUrl)) {
    link = validLinks.find((l) => linkMatchesScreen(l, screen, component));
  }

  if (!link && previewUsesScreenParam(previewUrl) && component && craftLinkPageExists(absRepo, inferredPagePath(component))) {
    link = {
      sourcePath: inferredPagePath(component),
      repoRoot: absRepo,
      previewUrl: validLinks.find((l) => l.previewUrl)?.previewUrl ?? manifest.links[0]?.previewUrl,
      syncMode: "manual",
      watchSource: false,
    };
  }

  if (link) {
    const pageLabel = path.basename(link.sourcePath.replace(/\\/g, "/"));
    return {
      ok: true,
      mode: "linked",
      pagePath: link.sourcePath.replace(/\\/g, "/"),
      captureUrl: captureUrlForPreview(previewUrl, pageLabel),
      link: { ...link, repoRoot: absRepo, previewUrl: captureUrlForPreview(previewUrl, pageLabel) },
      repoRoot: absRepo,
    };
  }

  const stale = manifest.links.find(
    (l) => linkMatchesPreviewRoute(l, previewUrl) || linkMatchesScreen(l, screen, component),
  );
  if (stale && !craftLinkPageExists(absRepo, stale.sourcePath)) {
    return {
      ok: false,
      error: `Linked path missing on disk: ${stale.sourcePath}. Update craft.link.json or run craft-bridge link.`,
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
