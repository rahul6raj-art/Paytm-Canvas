import fs from "node:fs";
import path from "node:path";
import { resolvePageSource } from "@paytm-craft/bridge";

/** Known ?screen= ids → page folders (relative to repo root). */
export const PREVIEW_SCREEN_PAGE_PATHS: Record<string, string[]> = {
  home: ["src/screens/PMLHomePage"],
  stocks: ["src/screens/PMLStocksPage"],
  signup: ["src/screens/PMLSignupPage"],
  more: ["src/screens/PMLMorePage"],
  fno: ["src/screens/PMLHomePage"],
  mf: ["src/screens/PMLHomePage"],
  onboarding: ["src/features/onboarding-flow"],
};

export function pagePathExists(repoRoot: string, relPath: string): boolean {
  const abs = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(abs)) return false;
  try {
    resolvePageSource(abs);
    return true;
  } catch {
    return false;
  }
}

function scanScreensDirectory(repoRoot: string, screenId: string): string[] {
  const screensDir = path.join(repoRoot, "src/screens");
  if (!fs.existsSync(screensDir)) return [];
  const slug = screenId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return [];

  const out: string[] = [];
  for (const ent of fs.readdirSync(screensDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const name = ent.name.toLowerCase();
    if (name.includes(`pml${slug}`) || (slug.length >= 3 && name.includes(slug))) {
      out.push(`src/screens/${ent.name}`);
    }
  }
  return out;
}

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Map preview pathname / Storybook id to likely page folders in any React repo. */
export function discoverPreviewPagePathFromUrl(
  repoRoot: string,
  previewUrl: string,
): string | null {
  try {
    const parsed = new URL(previewUrl.includes("://") ? previewUrl : `http://${previewUrl}`);
    const candidates = new Set<string>();

    const storyPath = parsed.searchParams.get("path")?.trim();
    if (storyPath) {
      const leaf = storyPath.split("/").filter(Boolean).pop() ?? "";
      const base = leaf.split("--")[0] ?? leaf;
      if (base) {
        candidates.add(`src/pages/${base}`);
        candidates.add(`src/screens/${titleCaseSegment(base)}`);
        candidates.add(`src/features/${base}`);
      }
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1]!;
      candidates.add(`src/pages/${last}`);
      candidates.add(`src/pages/${segments.join("/")}`);
      candidates.add(`src/screens/${titleCaseSegment(last)}`);
      candidates.add(`src/routes/${last}`);
      candidates.add(`app/${segments.join("/")}/page.tsx`.replace(/\/page\.tsx$/, ""));
    }

    for (const rel of candidates) {
      const norm = rel.replace(/\\/g, "/");
      if (pagePathExists(repoRoot, norm)) return norm;
    }
  } catch {
    return null;
  }
  return null;
}

/** Resolve a linked page folder for the screen shown in the preview URL, if one exists on disk. */
export function discoverPreviewPagePath(repoRoot: string, screenId: string): string | null {
  const candidates = [
    ...(PREVIEW_SCREEN_PAGE_PATHS[screenId] ?? []),
    ...scanScreensDirectory(repoRoot, screenId),
  ];
  const seen = new Set<string>();
  for (const rel of candidates) {
    const norm = rel.replace(/\\/g, "/");
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (pagePathExists(repoRoot, norm)) return norm;
  }
  return null;
}
