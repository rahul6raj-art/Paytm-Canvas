import { exportReactSource } from "@/lib/codeRoundTrip/reactExport";
import { exportHtmlSource } from "@/lib/codeExport/exportHtmlSource";
import { exportPageCssFiles } from "@/lib/codeRoundTrip/exportPageCss";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import { buildSemanticBridgeExportBundle } from "@/lib/craftBridge/bridgeRoundTripExport";
import { hashStringSha256 } from "@/lib/craftBridge/canvasExportHash";
import { fetchLinkedSourceContent, type ReadSourceResponse } from "@/lib/craftBridge/readLinkedSource";
import { shouldUseSemanticBridgeSync } from "@/lib/craftBridge/semanticBridgeSync";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export type SyncSourceInput = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds: string[];
  designTokens: Record<string, DesignToken>;
  assets: Record<string, EditorAsset>;
  fileName: string;
  sourceHeader: string | null;
  link: CodeRoundTripLink;
  /** Must be true — canvas never writes source without an explicit user action. */
  explicitUserExport?: boolean;
};

export type SyncSourceResult =
  | {
      ok: true;
      hash: string;
      writtenAt: string;
      absolutePath: string;
      skipped: boolean;
      cssWritten?: string[];
    }
  | { ok: false; error: string };

export function linkedSourceFormat(sourcePath: string): "react" | "html" {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "react";
}

export function buildLinkedExportSource(input: SyncSourceInput): string | null {
  const exportInput = {
    nodes: input.nodes,
    childOrder: input.childOrder,
    selectedIds: input.selectedIds,
    designTokens: input.designTokens,
    assets: input.assets,
    fileName: input.fileName,
    sourceHeader: input.sourceHeader,
    codeRoundTripLink: input.link,
  };

  const result =
    linkedSourceFormat(input.link.sourcePath) === "html"
      ? exportHtmlSource(exportInput)
      : exportReactSource(exportInput);
  if (
    result.exportRootIds.length === 0 ||
    Object.keys(result.payload.nodes).length === 0
  ) {
    return null;
  }
  return result.source;
}

export async function fetchLinkedCssFiles(
  link: CodeRoundTripLink,
): Promise<{ path: string; content: string }[]> {
  const paths = (link.cssPaths ?? []).filter((p) => p?.trim());
  const files: { path: string; content: string }[] = [];
  for (const cssPath of paths) {
    const params = new URLSearchParams({
      repoRoot: link.repoRoot,
      sourcePath: cssPath,
    });
    const res = await bridgeFetch(`/api/craft-bridge/read-source?${params}`);
    if (!res.ok) continue;
    const body = (await res.json()) as ReadSourceResponse;
    if (body.content !== undefined) {
      files.push({ path: cssPath, content: body.content });
    }
  }
  return files;
}

async function writeLinkedSourceFile(input: {
  repoRoot: string;
  sourcePath: string;
  content: string;
  ifMatchHash?: string;
}): Promise<
  | { ok: true; hash: string; writtenAt: string; absolutePath: string }
  | { ok: false; error: string }
> {
  const res = await bridgeFetch("/api/craft-bridge/write-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await res.json()) as
    | { ok: true; hash: string; writtenAt: string; absolutePath: string }
    | { error: string };

  if (!res.ok) {
    return { ok: false, error: "error" in body ? body.error : `Sync failed (${res.status})` };
  }
  if (!("hash" in body)) {
    return { ok: false, error: "Invalid bridge response." };
  }
  return body;
}

export async function computeCanvasExportHash(input: SyncSourceInput): Promise<string | null> {
  const read = await fetchLinkedSourceContent(input.link);
  if ("ok" in read && read.ok === false) return null;
  if (
    linkedSourceFormat(input.link.sourcePath) === "react" &&
    shouldUseSemanticBridgeSync(input.link, read.content)
  ) {
    const cssFiles = await fetchLinkedCssFiles(input.link);
    const bundle = await buildSemanticBridgeExportBundle({
      sourcePath: input.link.sourcePath,
      cssPaths: input.link.cssPaths ?? [],
      sourceContent: read.content,
      cssFiles,
      nodes: input.nodes,
      designTokens: input.designTokens,
    });
    return bundle.hash;
  }
  const source = buildLinkedExportSource(input);
  if (!source) return null;
  return hashStringSha256(source);
}

function isSemanticLiveBridgeExport(
  link: CodeRoundTripLink,
  sourceContent: string,
): boolean {
  return (
    linkedSourceFormat(link.sourcePath) === "react" &&
    shouldUseSemanticBridgeSync(link, sourceContent)
  );
}

export async function syncSourceToLinkedFile(input: SyncSourceInput): Promise<SyncSourceResult> {
  if (!input.explicitUserExport) {
    return {
      ok: true,
      hash: input.link.lastExportedHash ?? "",
      writtenAt: input.link.lastSyncedAt ?? new Date().toISOString(),
      absolutePath: "",
      skipped: true,
    };
  }

  const read = await fetchLinkedSourceContent(input.link);
  if ("ok" in read && read.ok === false) {
    return { ok: false, error: read.error };
  }
  const sourceRead = read as ReadSourceResponse;

  let exported: string | null = null;
  let semanticBundle: Awaited<ReturnType<typeof buildSemanticBridgeExportBundle>> | null = null;
  const semanticExport = isSemanticLiveBridgeExport(input.link, sourceRead.content);
  if (semanticExport) {
    const cssFiles = await fetchLinkedCssFiles(input.link);
    semanticBundle = await buildSemanticBridgeExportBundle({
      sourcePath: input.link.sourcePath,
      cssPaths: input.link.cssPaths ?? [],
      sourceContent: sourceRead.content,
      cssFiles,
      nodes: input.nodes,
      designTokens: input.designTokens,
    });
    exported = semanticBundle.tsx;
  } else {
    exported = buildLinkedExportSource(input);
  }

  if (!exported) {
    return {
      ok: true,
      hash: input.link.lastExportedHash ?? "",
      writtenAt: input.link.lastSyncedAt ?? new Date().toISOString(),
      absolutePath: "",
      skipped: true,
    };
  }

  const tsxResult = await writeLinkedSourceFile({
    repoRoot: input.link.repoRoot,
    sourcePath: input.link.sourcePath,
    content: exported,
    ifMatchHash: input.link.lastExportedHash,
  });

  if (!tsxResult.ok) {
    return { ok: false, error: tsxResult.error };
  }

  const cssWritten: string[] = [];
  const cssPaths = (input.link.cssPaths ?? []).filter((p) => p?.trim());
  if (semanticExport && semanticBundle && semanticBundle.cssFiles.length > 0) {
    for (const file of semanticBundle.cssFiles) {
      const cssWrite = await writeLinkedSourceFile({
        repoRoot: input.link.repoRoot,
        sourcePath: file.path,
        content: file.content,
      });
      if (!cssWrite.ok) {
        return { ok: false, error: cssWrite.error };
      }
      cssWritten.push(file.path);
    }
  } else if (!semanticExport && cssPaths.length > 0) {
    const originalCss = await fetchLinkedCssFiles(input.link);
    const updatedCss = exportPageCssFiles({
      nodes: input.nodes,
      designTokens: input.designTokens,
      originalCssFiles: originalCss,
    });

    for (const file of updatedCss) {
      const original = originalCss.find((f) => f.path === file.path);
      if (original?.content === file.content) continue;

      const cssWrite = await writeLinkedSourceFile({
        repoRoot: input.link.repoRoot,
        sourcePath: file.path,
        content: file.content,
      });
      if (!cssWrite.ok) {
        return { ok: false, error: cssWrite.error };
      }
      cssWritten.push(file.path);
    }
  }

  const skipped =
    !!input.link.lastExportedHash &&
    input.link.lastExportedHash === (semanticBundle?.hash ?? tsxResult.hash) &&
    cssWritten.length === 0;

  return {
    ok: true,
    hash: semanticBundle?.hash ?? tsxResult.hash,
    writtenAt: tsxResult.writtenAt,
    absolutePath: tsxResult.absolutePath,
    skipped,
    cssWritten: cssWritten.length > 0 ? cssWritten : undefined,
  };
}
