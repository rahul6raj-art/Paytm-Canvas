import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { ReactImportResult } from "./reactImport";
import { importReactSource } from "./reactImport";
import { applyPageCssToSlice } from "./applyPageCssToSlice";
import { relayoutFlowChildrenInSlice } from "./flowSiblingLayout";
import { finalizeImportedGraph } from "./finalizeImportedGraph";
import { pinPhoneShellBottomChromeNodes } from "@/lib/webImport/phoneShellBottomChrome";
import { normalizeBottomNavTextNodes, normalizeListItemTextNodes } from "@/lib/webImport/normalizeWebImportLayers";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import {
  mergeDesignTokenRecords,
  projectDesignTokensWithColorModesFromCssSources,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import { tokenizeImportedNodes } from "@/lib/craftBridge/tokenizeImportedNodes";
import {
  applyCanvasScreenLabelToRoots,
  canvasScreenLabelFromSource,
} from "@/lib/craftBridge/canvasScreenLabels";
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
  cssSources: string[] = [],
  sourceFileName?: string,
): import("@/lib/documentPersistence").EditorPersistSlice {
  const rootIds = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
  const screenLabel = sourceFileName
    ? canvasScreenLabelFromSource(sourceFileName)
    : canvasScreenLabelFromSource(slice.fileName);
  let nodes = relayoutFlowChildrenInSlice(slice, cssSources).nodes;
  nodes = finalizeImportedGraph(nodes, slice.childOrder, {
    preserveAbsoluteLayout: true,
  });
  const shellHeight =
    Object.values(nodes).find((n) => isPhoneShellClassName(n.codeClassName))?.height ??
    nodes[rootIds[0] ?? ""]?.height ??
    844;
  pinPhoneShellBottomChromeNodes(nodes, slice.childOrder, shellHeight);
  normalizeBottomNavTextNodes(nodes);
  normalizeListItemTextNodes(nodes, slice.childOrder);
  nodes = placeScreenFrameOnCanvas(nodes, rootIds);
  for (const rootId of rootIds) {
    const root = nodes[rootId];
    if (root) {
      nodes[rootId] = { ...root, parentId: null, clipChildren: false };
    }
  }
  nodes = applyCanvasScreenLabelToRoots(nodes, rootIds, screenLabel);
  return {
    ...slice,
    nodes,
    fileName: screenLabel,
    selectedIds: rootIds.length ? rootIds : slice.selectedIds,
  };
}

/** Import a page component (.tsx) with optional companion stylesheet(s) from the same folder. */
export function importReactPageBundle(input: ReactPageBundleInput): ReactImportResult {
  const result = importReactSource(input.tsxSource, { fileName: input.fileName });
  if (!result.ok) return result;

  const cssSources = (input.cssSources ?? []).filter((c) => c?.trim());
  const importTheme = input.theme ?? "light";
  const withCss =
    cssSources.length > 0
      ? applyPageCssToSlice(result.slice, cssSources, importTheme)
      : result.slice;
  let slice = finalizePageCssSlice(withCss, cssSources, input.fileName);
  const projectTokens = projectDesignTokensWithColorModesFromCssSources(cssSources);
  const designTokens = mergeDesignTokenRecords(slice.designTokens, projectTokens);
  slice = {
    ...slice,
    designTokens,
    nodes: tokenizeImportedNodes(slice.nodes, designTokens, {
      importMode: importTheme,
      cssSources,
    }),
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
