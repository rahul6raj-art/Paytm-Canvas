import path from "node:path";
import { readSourceFile, writePendingImport } from "@paytm-craft/bridge";
import { importBridgeFromLivePreview } from "@/lib/craftBridge/bridgeLiveImport";
import { buildBridgeEditorOpenUrl } from "@/lib/craftBridge/buildBridgeEditorOpenUrl";
import {
  canvasScreenLabelFromPreviewUrl,
  previewCaptureSourcePath,
  previewRouteKey,
} from "@/lib/craftBridge/previewRouteKey";
import { readCraftLinkManifest } from "@/lib/craftBridge/resolvePreviewPushLink";
import { applyCaptureThemeToUrl, defaultCaptureColorTheme } from "@/lib/webImport/captureTheme";
import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";
import type { RunBridgePageImportResult } from "@/lib/craftBridge/runBridgePageImport";

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

export type RunBridgePreviewCaptureInput = {
  previewUrl: string;
  repoRoot: string;
  /** Optional linked source for structure merge + Send to code round-trip. */
  pagePath?: string;
  sourceCode?: string;
  cssPaths?: string[];
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

  const captureUrl = applyCaptureThemeToUrl(previewUrl, defaultCaptureColorTheme());
  const routeKey = previewRouteKey(previewUrl);
  const virtualSource = previewCaptureSourcePath(previewUrl);

  let sourceCode = input.sourceCode?.trim() ?? "";
  const cssRelPaths = input.cssPaths ?? [];
  const companionCss: string[] = [];

  if (input.pagePath?.trim()) {
    const tsxRead = readSourceFile(
      repoRoot,
      input.pagePath.replace(/\\/g, "/"),
    );
    if (tsxRead.ok) sourceCode = tsxRead.content;
  }

  for (const rel of cssRelPaths) {
    const cssRead = readSourceFile(repoRoot, rel);
    if (cssRead.ok) companionCss.push(cssRead.content);
  }
  if (companionCss.length === 0) {
    companionCss.push(...collectManifestCss(repoRoot));
  }

  const live = await importBridgeFromLivePreview({
    previewUrl: captureUrl,
    sourceCode: sourceCode || undefined,
    fileName: input.pagePath ? path.basename(input.pagePath) : undefined,
    cssSources: companionCss,
    theme: defaultCaptureColorTheme(),
    screenLabel: canvasScreenLabelFromPreviewUrl(previewUrl),
  });

  if (!live.ok) {
    return { ok: false, error: live.error, status: 503 };
  }

  const link = {
    sourcePath: input.pagePath?.replace(/\\/g, "/") ?? virtualSource,
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
