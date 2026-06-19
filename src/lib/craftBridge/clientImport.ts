import { importReactPageBundle } from "@/lib/codeRoundTrip/importReactPageBundle";
import { importHtmlPageBundle } from "@/lib/codeRoundTrip/importHtmlPageBundle";
import { importReactSource } from "@/lib/codeRoundTrip/reactImport";
import { importHtmlFromString } from "@/lib/codeImport/htmlImport";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import { normalizeBridgeImportSlice } from "@/lib/craftBridge/normalizeBridgeImportSlice";
import {
  fetchLinkedCompanionCss,
  fetchLinkedSourceContent,
  type ReadSourceResponse,
} from "@/lib/craftBridge/readLinkedSource";
import { shouldUseSemanticBridgeSync } from "@/lib/craftBridge/semanticBridgeSync";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

export { fetchLinkedSourceContent, type ReadSourceResponse } from "@/lib/craftBridge/readLinkedSource";

export type ImportFromLinkedSourceResult =
  | {
      ok: true;
      hash: string;
      slice: import("@/lib/documentPersistence").EditorPersistSlice;
      sourceHeader?: string;
      codeRoundTripLink?: CodeRoundTripLink | null;
      componentName: string;
      message: string;
    }
  | { ok: false; error: string };

function formatFromPath(sourcePath: string): "react" | "html" {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "react";
}

export function parseLinkedSourceContent(
  content: string,
  sourcePath: string,
  fileName?: string,
  companionCss?: string[],
): ImportFromLinkedSourceResult {
  const cssSources = (companionCss ?? []).filter((c) => c?.trim());
  const format = formatFromPath(sourcePath);

  if (format === "html") {
    const result =
      cssSources.length > 0
        ? importHtmlPageBundle({
            htmlSource: content,
            cssSources,
            fileName: fileName ?? sourcePath,
          })
        : importHtmlFromString(content, { fileName: fileName ?? sourcePath });
    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      hash: "",
      slice: result.slice,
      sourceHeader: result.sourceHeader,
      codeRoundTripLink: result.codeRoundTripLink,
      componentName: result.componentName,
      message: result.message,
    };
  }

  const result =
    cssSources.length > 0
      ? importReactPageBundle({
          tsxSource: content,
          cssSources,
          fileName: fileName ?? sourcePath,
        })
      : importReactSource(content, { fileName: fileName ?? sourcePath });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    hash: "",
    slice: result.slice,
    sourceHeader: result.sourceHeader,
    codeRoundTripLink: result.codeRoundTripLink,
    componentName: result.componentName,
    message: result.message,
  };
}

export async function importFromLinkedSourceFile(
  link: CodeRoundTripLink,
): Promise<ImportFromLinkedSourceResult> {
  const fetched = await fetchLinkedSourceContent(link);
  if ("ok" in fetched && fetched.ok === false) {
    return fetched;
  }
  const read = fetched as ReadSourceResponse;

  if (link.previewUrl?.trim() && shouldUseSemanticBridgeSync(link, read.content)) {
    const res = await bridgeFetch("/api/craft-bridge/reimport-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoRoot: link.repoRoot,
        sourcePath: link.sourcePath,
        previewUrl: link.previewUrl,
      }),
    });
    const body = (await res.json()) as
      | {
          ok: true;
          slice: import("@/lib/documentPersistence").EditorPersistSlice;
          componentName: string;
          message: string;
          sourceHeader?: string;
          hash: string;
        }
      | { error: string };
    if (!res.ok || !("slice" in body)) {
      return { ok: false, error: "error" in body ? body.error : `Live re-import failed (${res.status})` };
    }
    return {
      ok: true,
      hash: body.hash,
      slice: normalizeBridgeImportSlice(body.slice),
      sourceHeader: body.sourceHeader,
      codeRoundTripLink: link,
      componentName: body.componentName,
      message: body.message,
    };
  }

  const companionCss = await fetchLinkedCompanionCss(link);
  const parsed = parseLinkedSourceContent(
    read.content,
    link.sourcePath,
    undefined,
    companionCss,
  );
  if (!parsed.ok) return parsed;
  return { ...parsed, hash: read.hash };
}
