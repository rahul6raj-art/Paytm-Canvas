import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { CodePanelFormat } from "@/lib/codeExport/selectionCodeExport";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import { isPaytmCraftRoundTripHtml } from "@/lib/codeExport/pcMetadata";
import { importReactSource } from "@/lib/codeRoundTrip/reactImport";
import { importHtmlFromString } from "./htmlImport";

export type CodeImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      componentName: string;
      message: string;
      sourceHeader?: string;
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
  opts?: { fileName?: string },
): CodeImportResult {
  if (format === "react") {
    const result = importReactSource(source, opts);
    if (!result.ok) return result;
    const slice = applyFrameCanvasPlacement(result.slice, source);
    return {
      ok: true,
      slice,
      componentName: result.componentName,
      message: result.message,
      sourceHeader: result.sourceHeader,
    };
  }

  const result = importHtmlFromString(source, opts);
  if (!result.ok) return result;
  return {
    ok: true,
    slice: result.slice,
    componentName: result.componentName,
    message: result.message,
  };
}

export { importHtmlFromString } from "./htmlImport";
export { parseInlineCss } from "./parseInlineCss";
