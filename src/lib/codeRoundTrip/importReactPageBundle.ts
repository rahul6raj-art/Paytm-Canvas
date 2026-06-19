import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { ReactImportResult } from "./reactImport";
import { importReactSource } from "./reactImport";
import { applyPageCssToSlice } from "./applyPageCssToSlice";
import { finalizeImportedGraph } from "./finalizeImportedGraph";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import {
  designTokensFromProjectCss,
  mergeDesignTokenRecords,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import { tokenizeImportedNodes } from "@/lib/craftBridge/tokenizeImportedNodes";
import type { CssThemeScope } from "@/lib/codeRoundTrip/parseCssCustomProperties";

export type ReactPageBundleInput = {
  tsxSource: string;
  /** Raw contents of page `.css` files (e.g. PMLSignupPage.css). */
  cssSources?: string[];
  fileName?: string;
  /** Theme for resolving `src/tokens/*.css` color variables. */
  theme?: CssThemeScope;
};

function finalizePageCssSlice(
  slice: import("@/lib/documentPersistence").EditorPersistSlice,
): import("@/lib/documentPersistence").EditorPersistSlice {
  const rootIds = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
  let nodes = finalizeImportedGraph(slice.nodes, slice.childOrder, {
    preserveAbsoluteLayout: true,
  });
  nodes = placeScreenFrameOnCanvas(nodes, rootIds);
  for (const rootId of rootIds) {
    const root = nodes[rootId];
    if (root) {
      nodes[rootId] = { ...root, parentId: null, clipChildren: false };
    }
  }
  return { ...slice, nodes, selectedIds: rootIds.length ? rootIds : slice.selectedIds };
}

/** Import a page component (.tsx) with optional companion stylesheet(s) from the same folder. */
export function importReactPageBundle(input: ReactPageBundleInput): ReactImportResult {
  const result = importReactSource(input.tsxSource, { fileName: input.fileName });
  if (!result.ok) return result;

  const cssSources = (input.cssSources ?? []).filter((c) => c?.trim());
  const withCss =
    cssSources.length > 0 ? applyPageCssToSlice(result.slice, cssSources) : result.slice;
  let slice = finalizePageCssSlice(withCss);
  const projectTokens = designTokensFromProjectCss(cssSources, input.theme ?? "light");
  const designTokens = mergeDesignTokenRecords(slice.designTokens, projectTokens);
  slice = {
    ...slice,
    designTokens,
    nodes: tokenizeImportedNodes(slice.nodes, designTokens),
  };
  const cssNote =
    cssSources.length > 0
      ? ` Applied styles from ${cssSources.length} page CSS file${cssSources.length === 1 ? "" : "s"}.`
      : "";
  const tokenCount = Object.keys(projectTokens).length;
  const tokenNote =
    tokenCount > 0
      ? ` ${tokenCount} project design token${tokenCount === 1 ? "" : "s"} in library.`
      : "";
  return {
    ...result,
    slice,
    message: `${result.message}${cssNote}${tokenNote}`,
  };
}
