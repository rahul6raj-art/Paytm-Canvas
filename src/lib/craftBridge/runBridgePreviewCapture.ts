import path from "node:path";
import { readSourceFile, resolvePageSource, toRepoRelativePaths, writePendingImport } from "@paytm-craft/bridge";
import { importBridgeFromLivePreview } from "@/lib/craftBridge/bridgeLiveImport";
import { buildBridgeEditorOpenUrl } from "@/lib/craftBridge/buildBridgeEditorOpenUrl";
import {
  canvasScreenLabelFromPreviewUrl,
  previewCaptureSourcePath,
  previewRouteKey,
} from "@/lib/craftBridge/previewRouteKey";
import {
  discoverPreviewPagePath,
  pagePathExists,
} from "@/lib/craftBridge/discoverPreviewPage";
import { previewScreenId, readCraftLinkManifest } from "@/lib/craftBridge/resolvePreviewPushLink";
import { syncCaptureThemeToUrl } from "@/lib/webImport/captureTheme";
import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";
import type { BridgeCaptureViewportInput } from "@/lib/craftBridge/resolveBridgeCaptureViewport";
import { parseCaptureViewportInput } from "@/lib/craftBridge/bridgeCaptureContext";

function collectManifestCss(repoRoot: string): string[] {
  const manifest = readCraftLinkManifest(repoRoot);
  if (!manifest?.links?.length) return [];
  const cssRel = new Set<string>();
  for (const link of manifest.links) {
    for (const rel of link.cssPaths ?? []) {
      if (rel?.trim()) cssRel.add(rel.replace(/\\/g, "/"));
    }
  }
  const out: string[] = [];
  for (const rel of cssRel) {
    const read = readSourceFile(repoRoot, rel);
    if (read.ok) out.push(read.content);
  }
  return out;
}

function resolveCaptureSource(
  repoRoot: string,
  input: RunBridgePreviewCaptureInput,
): {
  pagePath?: string;
  sourceCode: string;
  cssRelPaths: string[];
  companionCss: string[];
} {
  let pagePath = input.pagePath?.trim().replace(/\\/g, "/");
  let sourceCode = input.sourceCode?.trim() ?? "";
  let cssRelPaths = (input.cssPaths ?? []).map((p) => p.replace(/\\/g, "/"));
  const companionCss: string[] = [];

  if (!pagePath && input.previewUrl.trim()) {
    pagePath = discoverPreviewPagePath(repoRoot, previewScreenId(input.previewUrl)) ?? undefined;
  }

  if (pagePath && pagePathExists(repoRoot, pagePath)) {
    try {
      const resolved = resolvePageSource(path.join(repoRoot, pagePath));
      const tsxRel = path.relative(repoRoot, resolved.tsxPath).replace(/\\/g, "/");
      if (!sourceCode) {
        const tsxRead = readSourceFile(repoRoot, tsxRel);
        if (tsxRead.ok) sourceCode = tsxRead.content;
      }
      if (cssRelPaths.length === 0) {
        cssRelPaths = toRepoRelativePaths(repoRoot, resolved.cssPaths);
      }
    } catch {
      /* capture-only without source merge */
    }
  }

  for (const rel of cssRelPaths) {
    const cssRead = readSourceFile(repoRoot, rel);
    if (cssRead.ok) companionCss.push(cssRead.content);
  }
  if (companionCss.length === 0) {
    companionCss.push(...collectManifestCss(repoRoot));
  }

  return { pagePath, sourceCode, cssRelPaths, companionCss };
}

export type RunBridgePreviewCaptureInput = {
  previewUrl: string;
  repoRoot: string;
  /** Optional linked source for structure merge + Send to code round-trip. */
  pagePath?: string;
  sourceCode?: string;
  cssPaths?: string[];
  viewport?: BridgeCaptureViewportInput;
};

/** Live-capture the current preview URL — works for main pages and internal routes. */
export async function runBridgePreviewCapture(
  input: RunBridgePreviewCaptureInput,
): Promise<RunBridgePageImportResult> {
  const previewUrl = input.previewUrl.trim();
  const repoRoot = path.resolve(input.repoRoot.trim());
  if (!previewUrl || !repoRoot) {
    return { ok: false, error: "previewUrl and repoRoot are required.", status: 400 };
  }

  const { url: captureUrl, theme: captureTheme } = syncCaptureThemeToUrl(previewUrl);
  const routeKey = previewRouteKey(previewUrl);
  const virtualSource = previewCaptureSourcePath(previewUrl);

  const { pagePath, sourceCode, cssRelPaths, companionCss } = resolveCaptureSource(repoRoot, input);

  const live = await importBridgeFromLivePreview({
    previewUrl: captureUrl,
    sourceCode: sourceCode || undefined,
    fileName: pagePath ? path.basename(pagePath) : undefined,
    cssSources: companionCss,
    theme: captureTheme,
    screenLabel: canvasScreenLabelFromPreviewUrl(previewUrl),
    viewport: input.viewport,
  });

  if (!live.ok) {
    return { ok: false, error: live.error, status: 503 };
  }

  const link = {
    sourcePath: pagePath ?? virtualSource,
    repoRoot,
    cssPaths: cssRelPaths.length ? cssRelPaths : undefined,
    previewUrl: captureUrl,
    syncMode: "manual" as const,
    watchSource: false,
  };

  const pending: CraftBridgePendingImport = {
    id: `bridge-preview-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    slice: live.slice,
    sourceHeader: live.sourceHeader,
    message: `${live.message} Route: ${routeKey}.`,
    captureViewport: parseCaptureViewportInput(input.viewport),
    link,
  };

  writePendingImport({
    ...pending,
    slice: pending.slice as unknown as Record<string, unknown>,
  });

  return {
    ok: true,
    pendingId: pending.id,
    componentName: live.componentName,
    message: pending.message ?? live.message,
    layerCount: Object.keys(live.slice.nodes).length,
    cssPaths: cssRelPaths,
    openUrl: buildBridgeEditorOpenUrl(pending.id),
  };
}
