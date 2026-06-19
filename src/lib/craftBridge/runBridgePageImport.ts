import path from "node:path";
import { importReactPageBundle } from "@/lib/codeRoundTrip/importReactPageBundle";
import { importHtmlPageBundle } from "@/lib/codeRoundTrip/importHtmlPageBundle";
import { importBridgeFromLivePreview } from "@/lib/craftBridge/bridgeLiveImport";
import { defaultCaptureColorTheme } from "@/lib/webImport/captureTheme";
import { writePendingImport } from "@paytm-craft/bridge";
import {
  resolvePageSource,
  readSourceFile,
  toRepoRelativePaths,
} from "@paytm-craft/bridge";
import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";

export type RunBridgePageImportInput = {
  repoRoot: string;
  pagePath: string;
  previewUrl?: string;
};

export type RunBridgePageImportResult =
  | {
      ok: true;
      pendingId: string;
      componentName: string;
      message: string;
      layerCount: number;
      cssPaths: string[];
    }
  | { ok: false; error: string; status: number };

export async function runBridgePageImport(
  input: RunBridgePageImportInput,
): Promise<RunBridgePageImportResult> {
  const repoRoot = input.repoRoot.trim();
  const pagePath = input.pagePath.trim();
  if (!repoRoot || !pagePath) {
    return { ok: false, error: "repoRoot and pagePath are required.", status: 400 };
  }

  const abs = path.resolve(repoRoot, pagePath);
  const resolved = resolvePageSource(abs);
  const tsxRead = readSourceFile(
    repoRoot,
    path.relative(repoRoot, resolved.tsxPath).replace(/\\/g, "/"),
  );
  if (!tsxRead.ok) {
    return { ok: false, error: tsxRead.error, status: 404 };
  }

  const cssRelPaths = toRepoRelativePaths(repoRoot, resolved.cssPaths);
  const companionCss: string[] = [];
  for (const rel of cssRelPaths) {
    const cssRead = readSourceFile(repoRoot, rel);
    if (cssRead.ok) companionCss.push(cssRead.content);
  }

  const tsxRel = path.relative(repoRoot, resolved.tsxPath).replace(/\\/g, "/");
  const previewUrl = input.previewUrl?.trim();
  let slice: CraftBridgePendingImport["slice"] | undefined;
  let componentName = "";
  let message = "";
  let sourceHeader: string | undefined;

  if (previewUrl) {
    const live = await importBridgeFromLivePreview({
      previewUrl,
      sourceCode: tsxRead.content,
      fileName: path.basename(resolved.tsxPath),
      cssSources: companionCss,
      theme: defaultCaptureColorTheme(),
    });
    if (live.ok) {
      slice = live.slice;
      componentName = live.componentName;
      message = live.message;
      sourceHeader = live.sourceHeader;
    } else {
      console.warn("[craft-bridge] live capture failed:", live.error);
      return { ok: false, error: live.error, status: 503 };
    }
  }

  if (!slice) {
    const result =
      resolved.format === "html"
        ? importHtmlPageBundle({
            htmlSource: tsxRead.content,
            cssSources: companionCss,
            fileName: path.basename(resolved.tsxPath),
          })
        : importReactPageBundle({
            tsxSource: tsxRead.content,
            cssSources: companionCss,
            fileName: path.basename(resolved.tsxPath),
          });
    if (!result.ok) {
      return { ok: false, error: result.error, status: 400 };
    }
    slice = result.slice;
    componentName = result.componentName;
    message = message ? `${message} ${result.message}` : result.message;
    sourceHeader = result.sourceHeader;
  }

  if (!slice || Object.keys(slice.nodes).length === 0) {
    return {
      ok: false,
      error: "No layers could be built from this page. Check preview URL and file content.",
      status: 400,
    };
  }

  const link = {
    sourcePath: tsxRel,
    repoRoot,
    cssPaths: cssRelPaths,
    previewUrl,
    syncMode: "manual" as const,
    watchSource: false,
  };

  const pending: CraftBridgePendingImport = {
    id: `bridge-page-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    slice,
    sourceHeader,
    message,
    link,
  };

  writePendingImport({
    ...pending,
    slice: pending.slice as unknown as Record<string, unknown>,
  });

  return {
    ok: true,
    pendingId: pending.id,
    componentName,
    message,
    layerCount: Object.keys(slice.nodes).length,
    cssPaths: cssRelPaths,
  };
}
