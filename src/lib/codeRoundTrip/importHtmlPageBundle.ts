import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { HtmlImportResult } from "@/lib/codeImport/htmlImport";
import { importHtmlFromString } from "@/lib/codeImport/htmlImport";
import { applyPageCssToSlice } from "./applyPageCssToSlice";
import { finalizeCodeImportGraph } from "./finalizeImportedGraph";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import {
  designTokensFromProjectCss,
  mergeDesignTokenRecords,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import { tokenizeImportedNodes } from "@/lib/craftBridge/tokenizeImportedNodes";

export type HtmlPageBundleInput = {
  htmlSource: string;
  cssSources?: string[];
  fileName?: string;
};

function finalizePageCssSlice(
  slice: import("@/lib/documentPersistence").EditorPersistSlice,
): import("@/lib/documentPersistence").EditorPersistSlice {
  const rootIds = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
  let nodes = finalizeCodeImportGraph(slice.nodes, slice.childOrder);
  nodes = placeScreenFrameOnCanvas(nodes, rootIds);
  for (const rootId of rootIds) {
    const root = nodes[rootId];
    if (root) {
      nodes[rootId] = { ...root, parentId: null };
    }
  }
  return { ...slice, nodes, selectedIds: rootIds.length ? rootIds : slice.selectedIds };
}

/** Import an HTML screen with optional companion stylesheet(s) from the same folder. */
export function importHtmlPageBundle(input: HtmlPageBundleInput): HtmlImportResult {
  const result = importHtmlFromString(input.htmlSource, { fileName: input.fileName });
  if (!result.ok) return result;

  const cssSources = (input.cssSources ?? []).filter((c) => c?.trim());
  if (cssSources.length === 0) return result;

  const withCss = applyPageCssToSlice(result.slice, cssSources);
  let slice = finalizePageCssSlice(withCss);
  const projectTokens = designTokensFromProjectCss(cssSources);
  const designTokens = mergeDesignTokenRecords(slice.designTokens, projectTokens);
  slice = {
    ...slice,
    designTokens,
    nodes: tokenizeImportedNodes(slice.nodes, designTokens, { cssSources }),
  };
  const cssCount = cssSources.length;
  const tokenCount = Object.keys(projectTokens).length;
  const tokenNote =
    tokenCount > 0
      ? ` ${tokenCount} project design token${tokenCount === 1 ? "" : "s"} in library.`
      : "";
  return {
    ...result,
    slice,
    message: `${result.message} Applied styles from ${cssCount} page CSS file${cssCount === 1 ? "" : "s"}.${tokenNote}`,
  };
}
