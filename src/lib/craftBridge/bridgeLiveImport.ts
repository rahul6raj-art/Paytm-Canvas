import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import { mergeStructureMetadataOntoLiveNodes } from "@/lib/codeRoundTrip/reactLiveImport";
import { sanitizeComponentName } from "@/lib/codeRoundTrip/reactStyle";
import { extractSourceHeader } from "@/lib/codeRoundTrip/reactJsxToGraph";
import { derivePreviewCaptureUrl } from "@/lib/codeRoundTrip/derivePreviewCaptureUrl";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import { prepareImportedSliceForCanvas } from "@/lib/prepareImportedSliceForCanvas";
import { enrichSliceWithProjectColorTokens } from "@/lib/craftBridge/projectTokenCss";
import { defaultCaptureColorTheme } from "@/lib/webImport/captureTheme";
import { assertPreviewReachable } from "@/lib/webImport/server/assertPreviewReachable";
import { runImportWebCapture } from "@/lib/webImport/server/playwrightCaptureService";
import { importWebResponseToPersistSlice } from "@/lib/webImport/webImportToPersistSlice";
import type { ImportWebRequest } from "@/lib/webImport/types";

export type BridgeLiveImportInput = {
  previewUrl: string;
  sourceCode?: string;
  fileName?: string;
  viewport?: { width: number; height: number };
  /** Raw CSS file contents (page + src/tokens/*.css) for color token library import. */
  cssSources?: string[];
  theme?: "light" | "dark";
};

export type BridgeLiveImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      componentName: string;
      message: string;
      sourceHeader?: string;
    }
  | { ok: false; error: string };

/** Bridge push: live Playwright capture for pixel-accurate editable layers. */
export async function importBridgeFromLivePreview(
  input: BridgeLiveImportInput,
): Promise<BridgeLiveImportResult> {
  const pageLabel =
    input.fileName?.replace(/\.[^.]+$/, "") ??
    input.sourceCode?.match(/export\s+(?:default\s+)?(?:function|const)\s+(\w+)/)?.[1];
  const captureUrl = derivePreviewCaptureUrl(input.previewUrl, pageLabel);
  const validated = validateReactPreviewUrl(captureUrl);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const viewport = input.viewport ?? { width: 390, height: 844 };
  const request: ImportWebRequest = {
    url: validated.url,
    mode: "editable",
    viewport,
    urlPolicy: "react-preview",
  };

  try {
    await assertPreviewReachable(validated.url);
    const capture = await runImportWebCapture(request);
    let slice = importWebResponseToPersistSlice(capture);

    if (input.sourceCode?.trim()) {
      slice = {
        ...slice,
        nodes: mergeStructureMetadataOntoLiveNodes(slice.nodes, input.sourceCode.trim()),
      };
    }

    const rootIds = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
    let nodes = placeScreenFrameOnCanvas(slice.nodes, rootIds);
    const phoneColumnWidth =
      capture.page.width >= 280 && capture.page.width <= 420
        ? Math.round(capture.page.width)
        : null;
    for (const rootId of rootIds) {
      const root = nodes[rootId];
      if (root) {
        nodes[rootId] = {
          ...root,
          parentId: null,
          clipChildren: true,
          ...(phoneColumnWidth
            ? { width: phoneColumnWidth, height: capture.page.height }
            : {}),
        };
      }
    }

    const componentName = sanitizeComponentName(
      input.fileName?.replace(/\.[^.]+$/, "") ??
        Object.values(nodes).find((n) => n.parentId === null)?.name ??
        "ImportedScreen",
    );

    const sourceHeader = input.sourceCode?.trim()
      ? extractSourceHeader(input.sourceCode)
      : undefined;

    const wrapped = wrapPersistSliceWithPages({
      ...slice,
      nodes,
      fileName: componentName,
      selectedIds: rootIds,
      canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    });
    let finalSlice = prepareImportedSliceForCanvas(wrapped);
    finalSlice = await enrichSliceWithProjectColorTokens(finalSlice, {
      cssSources: input.cssSources,
      theme: input.theme ?? defaultCaptureColorTheme(),
    });

    const layerCount = Object.keys(finalSlice.nodes).length;
    const tokenCount = Object.keys(finalSlice.designTokens ?? {}).length;
    const tokenNote =
      tokenCount > 0
        ? ` ${tokenCount} project design token${tokenCount === 1 ? "" : "s"} in library.`
        : "";
    return {
      ok: true,
      slice: finalSlice,
      componentName,
      sourceHeader: sourceHeader || undefined,
      message: `Live capture: ${layerCount} editable layer(s) from ${validated.url}.${tokenNote}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Live capture failed.";
    return { ok: false, error: msg };
  }
}
