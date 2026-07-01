import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import { mergeStructureMetadataOntoLiveNodes } from "@/lib/codeRoundTrip/reactLiveImport";
import { sanitizeComponentName } from "@/lib/codeRoundTrip/reactStyle";
import { extractSourceHeader } from "@/lib/codeRoundTrip/reactJsxToGraph";
import { derivePreviewCaptureUrl } from "@/lib/codeRoundTrip/derivePreviewCaptureUrl";
import { shouldPreservePreviewCaptureUrl } from "@/lib/codeRoundTrip/previewCaptureRoute";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import { prepareImportedSliceForCanvas } from "@/lib/prepareImportedSliceForCanvas";
import { enrichSliceWithProjectColorTokens } from "@/lib/craftBridge/projectTokenCss";
import {
  applyCanvasScreenLabelToRoots,
  canvasScreenLabelFromPageTitle,
  canvasScreenLabelFromSource,
} from "@/lib/craftBridge/canvasScreenLabels";
import { resolveBridgeImportColorTheme } from "@/lib/webImport/captureTheme";
import { assertPreviewReachable } from "@/lib/webImport/server/assertPreviewReachable";
import { runImportWebCapture } from "@/lib/webImport/server/playwrightCaptureService";
import { importWebResponseToPersistSlice } from "@/lib/webImport/webImportToPersistSlice";
import { buildBridgeImportWebRequest, enforceBridgeViewportArtboard } from "@/lib/craftBridge/bridgeCaptureViewport";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import {
  resolveBridgeCaptureViewport,
  type BridgeCaptureViewportInput,
} from "@/lib/craftBridge/resolveBridgeCaptureViewport";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";
import { finalizeBridgeLiveCapture } from "@/lib/craftBridge/finalizeBridgeLiveCapture";
import {
  assertBridgeCaptureFidelity,
} from "@/lib/craftBridge/bridgeCaptureValidate";

export type BridgeLiveImportInput = {
  previewUrl: string;
  sourceCode?: string;
  fileName?: string;
  viewport?: BridgeCaptureViewportInput;
  /** Raw CSS file contents (page + src/tokens/*.css) for color token library import. */
  cssSources?: string[];
  theme?: "light" | "dark";
  /** Override canvas artboard name (e.g. from preview URL route). */
  screenLabel?: string;
  /** Unused — bridge push is editable layers only (no screenshot reference). */
  includeScreenshotReference?: boolean;
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

/** Bridge push: editable layers at Playwright DOM coordinates — geometry preserved as captured. */
export async function importBridgeFromLivePreview(
  input: BridgeLiveImportInput,
): Promise<BridgeLiveImportResult> {
  const pageLabel =
    input.fileName?.replace(/\.[^.]+$/, "") ??
    input.sourceCode?.match(/export\s+(?:default\s+)?(?:function|const)\s+(\w+)/)?.[1];

  const captureUrl = shouldPreservePreviewCaptureUrl(input.previewUrl, pageLabel)
    ? input.previewUrl.trim()
    : derivePreviewCaptureUrl(input.previewUrl, pageLabel);

  const validated = validateReactPreviewUrl(captureUrl);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const captureViewport = resolveBridgeCaptureViewport(input.viewport, validated.url);
  const request = buildBridgeImportWebRequest(validated.url, captureViewport);

  try {
    await assertPreviewReachable(validated.url);
    const capture = await runImportWebCapture(request);
    let slice = importWebResponseToPersistSlice(capture, { bridgeCapture: true });

    if (input.sourceCode?.trim()) {
      slice = {
        ...slice,
        nodes: mergeStructureMetadataOntoLiveNodes(slice.nodes, input.sourceCode.trim(), {
          bridgeCapture: true,
        }),
      };
    }

    const rootIds = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
    let nodes = placeScreenFrameOnCanvas(slice.nodes, rootIds);
    enforceBridgeViewportArtboard(nodes, slice.childOrder);

    const componentName = sanitizeComponentName(
      input.fileName?.replace(/\.[^.]+$/, "") ??
        Object.values(nodes).find((n) => n.parentId === null)?.name ??
        "ImportedScreen",
    );
    const screenLabel =
      input.screenLabel?.trim() ||
      (input.fileName ? canvasScreenLabelFromSource(input.fileName) : null) ||
      canvasScreenLabelFromPageTitle(capture.page.title) ||
      canvasScreenLabelFromSource(componentName);
    nodes = applyCanvasScreenLabelToRoots(nodes, rootIds, screenLabel);

    const sourceHeader = input.sourceCode?.trim()
      ? extractSourceHeader(input.sourceCode)
      : undefined;

    const wrapped = wrapPersistSliceWithPages({
      ...slice,
      nodes,
      fileName: screenLabel,
      selectedIds: rootIds,
      canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    });
    const importTheme = resolveBridgeImportColorTheme(validated.url, input.theme);
    let finalSlice = prepareImportedSliceForCanvas(wrapped, { preserveCaptureGeometry: true });
    finalSlice = await enrichSliceWithProjectColorTokens(finalSlice, {
      cssSources: input.cssSources,
      theme: importTheme,
      preserveCaptureGeometry: true,
      rebakeColors: false,
    });

    const finalNodes = { ...finalSlice.nodes };
    enforceBridgeViewportArtboard(finalNodes, finalSlice.childOrder);

    const phoneShellCapture = Object.values(finalNodes).some(
      (n) =>
        n.parentId === null && isPhoneShellClassName(n.codeClassName),
    );
    const phoneCapture = captureViewport.phoneCapture || phoneShellCapture;
    const columnWidth = phoneCapture ? PML_PHONE_COLUMN_WIDTH : captureViewport.width;

    finalizeBridgeLiveCapture(finalNodes, finalSlice.childOrder, columnWidth, {
      cssSources: finalSlice.projectCssSources ?? input.cssSources,
      theme: importTheme,
    });
    enforceBridgeViewportArtboard(finalNodes, finalSlice.childOrder);

    try {
      const fidelity = assertBridgeCaptureFidelity(finalNodes, finalSlice.childOrder, {
        strict: true,
        tolerancePx: 1,
        requireRoundTripMetadata: Boolean(input.sourceCode?.trim()),
        expectPhoneArtboard: phoneCapture,
      });
      if (fidelity.warnings.length > 0) {
        console.warn(
          `[bridge-capture] ${fidelity.warnings.length} fidelity warning(s):`,
          fidelity.warnings.map((w) => w.message).join("; "),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Capture fidelity check failed.";
      return { ok: false, error: msg };
    }

    finalSlice = { ...finalSlice, nodes: finalNodes };

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
      message: `Editable capture (${layerCount} layers) from ${validated.url} — live DOM positions and sizes preserved.${tokenNote}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Live capture failed.";
    return { ok: false, error: msg };
  }
}
