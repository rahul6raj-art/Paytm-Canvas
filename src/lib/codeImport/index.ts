import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { CodePanelFormat } from "@/lib/codeExport/selectionCodeExport";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import { isPaytmCraftRoundTripHtml } from "@/lib/codeExport/pcMetadata";
import { importReactPageBundle } from "@/lib/codeRoundTrip/importReactPageBundle";
import { importHtmlPageBundle } from "@/lib/codeRoundTrip/importHtmlPageBundle";
import { importReactSource, looksLikeReactSource } from "@/lib/codeRoundTrip/reactImport";
import { importHtmlFromString } from "./htmlImport";

export type CodeImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      componentName: string;
      message: string;
      sourceHeader?: string;
      codeRoundTripLink?: import("@/lib/craftBridge/types").CodeRoundTripLink | null;
    }
  | { ok: false; error: string };

function applyFrameCanvasPlacement(
  slice: EditorPersistSlice,
  source: string,
): EditorPersistSlice {
  const isRoundTrip =
    isPaytmCraftRoundTripHtml(source) || source.includes("data-pc-root");
  if (!isRoundTrip) return slice;

  const rootIds = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
  return {
    ...slice,
    nodes: placeScreenFrameOnCanvas(slice.nodes, rootIds),
  };
}

export function importCodeSource(
  source: string,
  format: CodePanelFormat,
  opts?: { fileName?: string; companionCss?: string[] },
): CodeImportResult {
  const effectiveFormat =
    format === "html" && looksLikeReactSource(source) ? "react" : format;

  const cssSources = (opts?.companionCss ?? []).filter((c) => c?.trim());

  if (effectiveFormat === "react") {
    const result =
      cssSources.length > 0
        ? importReactPageBundle({ tsxSource: source, cssSources, fileName: opts?.fileName })
        : importReactSource(source, opts);
    if (!result.ok) return result;
    const slice = applyFrameCanvasPlacement(result.slice, source);
    const autoReact = format === "html" && effectiveFormat === "react";
    return {
      ok: true,
      slice,
      componentName: result.componentName,
      message: autoReact
        ? `${result.message} (auto-detected React — use the React format toggle next time.)`
        : result.message,
      sourceHeader: result.sourceHeader,
      codeRoundTripLink: result.codeRoundTripLink,
    };
  }

  const result =
    cssSources.length > 0
      ? importHtmlPageBundle({ htmlSource: source, cssSources, fileName: opts?.fileName })
      : importHtmlFromString(source, opts);
  if (!result.ok) return result;
  const slice = applyFrameCanvasPlacement(result.slice, source);
  return {
    ok: true,
    slice,
    componentName: result.componentName,
    message: result.message,
    sourceHeader: result.sourceHeader,
    codeRoundTripLink: result.codeRoundTripLink,
  };
}

export { importHtmlFromString } from "./htmlImport";
export { parseInlineCss } from "./parseInlineCss";
