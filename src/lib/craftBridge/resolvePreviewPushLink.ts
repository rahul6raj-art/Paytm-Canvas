import fs from "node:fs";
import path from "node:path";
import { resolvePageSource } from "@paytm-craft/bridge";
import { derivePreviewCaptureUrl } from "@/lib/codeRoundTrip/derivePreviewCaptureUrl";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

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

function inferredPagePath(component: string): string {
  return `src/screens/${component}`;
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
    return u.searchParams.get("screen")?.trim() || "home";
  } catch {
    return "home";
  }
}

export type PreviewPushResolution =
  | {
      ok: true;
      pagePath: string;
      captureUrl: string;
      link: CodeRoundTripLink;
      repoRoot: string;
    }
  | { ok: false; error: string };

/** Map live preview URL (?screen=…) to a linked page folder in craft.link.json. */
export function resolvePreviewPushLink(
  repoRoot: string,
  previewUrl: string,
): PreviewPushResolution {
  const absRepo = path.resolve(repoRoot);
  const manifest = readCraftLinkManifest(absRepo);
  if (!manifest?.links?.length) {
    return {
      ok: false,
      error: "No links in craft.link.json. Run Craft Bridge → Link page folder first.",
    };
  }

  const screen = previewScreenId(previewUrl);
  const component = SCREEN_TO_COMPONENT[screen];
  const validLinks = manifest.links.filter((l) => craftLinkPageExists(absRepo, l.sourcePath));

  let link = validLinks.find((l) => linkMatchesScreen(l, screen, component));

  if (!link && component && craftLinkPageExists(absRepo, inferredPagePath(component))) {
    link = {
      sourcePath: inferredPagePath(component),
      repoRoot: absRepo,
      previewUrl: validLinks.find((l) => l.previewUrl)?.previewUrl ?? manifest.links[0]?.previewUrl,
      syncMode: "manual",
      watchSource: false,
    };
  }

  if (!link) {
    const stale = manifest.links.find((l) => linkMatchesScreen(l, screen, component));
    if (stale && !craftLinkPageExists(absRepo, stale.sourcePath)) {
      return {
        ok: false,
        error: `Linked path missing on disk: ${stale.sourcePath}. Update craft.link.json or run craft-bridge link.`,
      };
    }
    return {
      ok: false,
      error: `No craft.link entry for screen "${screen}". Link that page folder in Cursor first.`,
    };
  }

  const pageLabel = path.basename(link.sourcePath.replace(/\\/g, "/"));
  const captureUrl = derivePreviewCaptureUrl(previewUrl, pageLabel);

  return {
    ok: true,
    pagePath: link.sourcePath.replace(/\\/g, "/"),
    captureUrl,
    link: { ...link, repoRoot: absRepo, previewUrl: captureUrl },
    repoRoot: absRepo,
  };
}
