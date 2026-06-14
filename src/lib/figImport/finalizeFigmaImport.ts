import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import {
  editorPatchFromFigmaImport,
  MAX_LOCAL_DOCUMENT_NODES,
} from "@/lib/documentPersistence";
import {
  FIG_IMPORT_AUTO_SAVE_NODE_CAP,
  FIG_IMPORT_POST_LAYOUT_NODE_CAP,
} from "@/lib/figImport/figImportConstants";
import { scheduleFigImportPostLayout } from "@/lib/figImport/scheduleFigImportPostLayout";
import {
  deferFigImportSave,
  scheduleFigImportStateApply,
  settleImportedDocumentUi,
} from "@/lib/figImport/figImportRuntime";
import { isFigImportCancelled } from "@/lib/figImport/figImportSession";
import { formatImportToast, type FigmaImportSummary } from "@/lib/figImport/figImportSummary";
import type { FigImportFidelityCapture } from "@/lib/figImport/figFidelityTypes";
import { runFigFidelityInspection } from "@/lib/figImport/runFigFidelityInspection";

export type { FigmaImportSummary } from "@/lib/figImport/figImportSummary";
export { formatImportToast } from "@/lib/figImport/figImportSummary";

export type FinalizeFigmaImportOptions = {
  prepared: PaytmCraftDocument;
  fileName?: string;
  /** Idle auto-layout pass for .fig imports (REST parser already runs layout on the server). */
  runPostLayout?: boolean;
  importGen?: number;
  figFidelityCaptures?: Record<string, FigImportFidelityCapture>;
};

function largeImportWarning(layerCount: number): string | undefined {
  if (layerCount > MAX_LOCAL_DOCUMENT_NODES) {
    return "This design is very large. It is open in the editor but was not saved to browser storage. Use File → Export to save a .paytmcraft.json copy.";
  }
  if (layerCount > FIG_IMPORT_AUTO_SAVE_NODE_CAP) {
    return "Large import — skipped auto-save to keep the editor responsive. Use File → Export to save a copy.";
  }
  return undefined;
}

function deferImportFollowUp(opts: {
  runPostLayout: boolean;
  summary: FigmaImportSummary;
}): void {
  const run = async () => {
    const { useEditorStore, toPersistSlice } = await import("@/stores/useEditorStore");
    const { layerCount } = opts.summary;

    if (
      opts.runPostLayout &&
      layerCount <= FIG_IMPORT_POST_LAYOUT_NODE_CAP
    ) {
      scheduleFigImportPostLayout(
        () => toPersistSlice(useEditorStore.getState()),
        (partial) => useEditorStore.setState(partial),
      );
    }

    let warning = opts.summary.warning ?? largeImportWarning(layerCount);
    if (!warning && layerCount > FIG_IMPORT_POST_LAYOUT_NODE_CAP) {
      warning =
        "Skipped background auto-layout reflow to keep the editor responsive. Frames use imported Figma positions.";
    }

    if (!warning && layerCount <= FIG_IMPORT_AUTO_SAVE_NODE_CAP) {
      deferFigImportSave(async () => {
        useEditorStore.getState().saveToLocal();
      });
    } else if (!opts.summary.warning) {
      useEditorStore.setState({ documentSaveStatus: "unsaved" });
    }

    if (warning && warning !== opts.summary.warning) {
      useEditorStore.setState({
        figImportToast: formatImportToast({ ...opts.summary, warning }),
      });
    }

    const st = useEditorStore.getState();
    if (st.figFidelityCaptures) {
      const refreshed = runFigFidelityInspection(st.figFidelityCaptures, st.nodes);
      useEditorStore.setState({ figFidelityReport: refreshed });
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => void run(), { timeout: 4000 });
  } else {
    setTimeout(() => void run(), 200);
  }
}

/**
 * Apply the imported document immediately. Viewport zoom/pan are precomputed during .fig conversion.
 */
export async function finalizeFigmaImportToEditor(
  opts: FinalizeFigmaImportOptions,
): Promise<FigmaImportSummary> {
  const { prepared, fileName, runPostLayout = false, importGen } = opts;
  const { useEditorStore } = await import("@/stores/useEditorStore");

  if (importGen != null && isFigImportCancelled(importGen)) {
    throw new Error("Import cancelled.");
  }

  const layerCount = Object.keys(prepared.nodes).length;
  const rootCount = (prepared.childOrder[EDITOR_ROOT_KEY] ?? []).length;
  const resolvedName = fileName ?? prepared.name ?? "Imported Figma";

  useEditorStore.setState({ figImportStatus: "Applying to canvas…" });

  const revision = useEditorStore.getState().documentHydrationRevision;
  const patch = editorPatchFromFigmaImport(prepared, revision);
  const roots = patch.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (roots.length === 0) {
    throw new Error(
      "No frames appeared on the canvas. In Figma, select the frame you want, press ⌘L (Copy link), and paste that URL.",
    );
  }

  const summary: FigmaImportSummary = {
    layerCount,
    rootCount,
    fileName: resolvedName,
    warning: largeImportWarning(layerCount),
  };

  if (importGen != null && isFigImportCancelled(importGen)) {
    throw new Error("Import cancelled.");
  }

  await scheduleFigImportStateApply(() => {
    const fidelityReport = opts.figFidelityCaptures
      ? runFigFidelityInspection(opts.figFidelityCaptures, patch.nodes)
      : null;
    useEditorStore.setState({
      ...patch,
      figImportStatus: "Rendering canvas…",
      figImportInProgress: true,
      documentSaveStatus: "unsaved",
      documentHydrating: false,
      fileName: resolvedName,
      editingTextId: null,
      historyPast: [],
      historyFuture: [],
      figFidelityCaptures: opts.figFidelityCaptures ?? null,
      figFidelityReport: fidelityReport,
      figFidelityOverlayEnabled: Boolean(fidelityReport && fidelityReport.mismatchedNodes > 0),
    });
  });

  await settleImportedDocumentUi(layerCount);

  await scheduleFigImportStateApply(() => {
    useEditorStore.setState({
      figImportInProgress: false,
      figImportStatus: null,
      figImportToast: formatImportToast(summary),
    });
  });

  deferImportFollowUp({ runPostLayout, summary });

  return summary;
}
