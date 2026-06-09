import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import {
  editorPatchFromFigmaImport,
  editorStateToDocument,
  isOversizedLocalDocument,
} from "@/lib/documentPersistence";
import { scheduleFigImportPostLayout } from "@/lib/figImport/scheduleFigImportPostLayout";
import {
  deferFigImportSave,
  scheduleFigImportStateApply,
  waitForNextPaint,
} from "@/lib/figImport/figImportRuntime";
import { isFigImportCancelled } from "@/lib/figImport/figImportSession";
import { formatImportToast, type FigmaImportSummary } from "@/lib/figImport/figImportSummary";
import { fitCanvasToImportedDocumentWithRetry } from "@/lib/viewportZoom";

export type { FigmaImportSummary } from "@/lib/figImport/figImportSummary";
export { formatImportToast } from "@/lib/figImport/figImportSummary";

export type FinalizeFigmaImportOptions = {
  prepared: PaytmCraftDocument;
  fileName?: string;
  /** Idle auto-layout pass for .fig imports (REST parser already runs layout on the server). */
  runPostLayout?: boolean;
  importGen?: number;
};

function deferImportFollowUp(opts: {
  runPostLayout: boolean;
  summary: FigmaImportSummary;
}): void {
  const run = async () => {
    const { useEditorStore, toPersistSlice } = await import("@/stores/useEditorStore");

    if (opts.runPostLayout) {
      scheduleFigImportPostLayout(
        () => toPersistSlice(useEditorStore.getState()),
        (partial) => useEditorStore.setState(partial),
      );
    }

    const doc = editorStateToDocument(toPersistSlice(useEditorStore.getState()));
    let warning = opts.summary.warning;
    if (!warning && isOversizedLocalDocument(doc)) {
      warning =
        "This design is very large. It is open in the editor but was not saved to browser storage. Use File → Export to save a .paytmcraft.json copy.";
      useEditorStore.setState({ documentSaveStatus: "unsaved" });
    } else if (!warning) {
      deferFigImportSave(async () => {
        useEditorStore.getState().saveToLocal();
      });
    }

    useEditorStore.setState({
      figImportToast: formatImportToast({ ...opts.summary, warning }),
    });

    void fitCanvasToImportedDocumentWithRetry();
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => void run(), { timeout: 1500 });
  } else {
    setTimeout(() => void run(), 50);
  }
}

/**
 * Dismiss overlay first, then apply the document on the next task so the UI stays responsive.
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
  };

  if (importGen != null && isFigImportCancelled(importGen)) {
    throw new Error("Import cancelled.");
  }

  useEditorStore.setState({
    figImportInProgress: false,
    figImportStatus: "Applying to canvas…",
  });

  await waitForNextPaint();

  if (importGen != null && isFigImportCancelled(importGen)) {
    throw new Error("Import cancelled.");
  }

  await scheduleFigImportStateApply(() => {
    useEditorStore.setState({
      ...patch,
      figImportStatus: null,
      documentSaveStatus: "unsaved",
      documentHydrating: false,
      fileName: resolvedName,
      editingTextId: null,
      historyPast: [],
      historyFuture: [],
    });
  });

  deferImportFollowUp({ runPostLayout, summary });

  return summary;
}
