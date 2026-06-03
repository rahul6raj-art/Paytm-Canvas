import { startTransition } from "react";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import {
  editorPatchFromFigmaImport,
  editorStateToDocument,
  isOversizedLocalDocument,
} from "@/lib/documentPersistence";
import { scheduleFigImportPostLayout } from "@/lib/figImport/scheduleFigImportPostLayout";
import { deferFigImportSave } from "@/lib/figImport/figImportRuntime";
import { fitCanvasToImportedDocumentWithRetry } from "@/lib/viewportZoom";
import { useEditorStore, toPersistSlice } from "@/stores/useEditorStore";

export type FinalizeFigmaImportOptions = {
  prepared: PaytmCraftDocument;
  fileName?: string;
  /** Idle auto-layout pass for .fig imports (REST parser already runs layout on the server). */
  runPostLayout?: boolean;
};

export type FigmaImportSummary = {
  layerCount: number;
  rootCount: number;
  fileName: string;
  warning?: string;
};

function deferImportFollowUp(opts: {
  runPostLayout: boolean;
  summary: FigmaImportSummary;
}): void {
  const run = () => {
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
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 50);
  }
}

/**
 * Phase 3: dismiss overlay synchronously, apply document on a transition, finalize on idle.
 */
export async function finalizeFigmaImportToEditor(
  opts: FinalizeFigmaImportOptions,
): Promise<FigmaImportSummary> {
  const { prepared, fileName, runPostLayout = false } = opts;
  const layerCount = Object.keys(prepared.nodes).length;
  const rootCount = (prepared.childOrder[EDITOR_ROOT_KEY] ?? []).length;
  const resolvedName = fileName ?? prepared.name ?? "Imported Figma";

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

  // Dismiss overlay on the main thread immediately — startTransition defers state and kept the overlay stuck.
  useEditorStore.setState({
    figImportInProgress: false,
    figImportStatus: null,
  });

  startTransition(() => {
    useEditorStore.setState({
      ...patch,
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

export function formatImportToast(summary: FigmaImportSummary): string {
  const base = `Imported “${summary.fileName}” — ${summary.rootCount} frame(s), ${summary.layerCount} layer(s).`;
  return summary.warning ? `${base} ${summary.warning}` : base;
}
