"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDownToLine, GitCompare, RefreshCw, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { syncSourceToLinkedFile } from "@/lib/craftBridge/clientSync";
import { useImportFromLinkedSource } from "@/components/craftBridge/CraftBridgeSourceWatcher";
import { CraftBridgeConflictModal } from "@/components/craftBridge/CraftBridgeConflictModal";

/** Shown when source file and canvas both changed since last sync. */
export function CraftBridgeConflictBanner() {
  const [diffOpen, setDiffOpen] = useState(false);
  const conflict = useEditorStore((s) => s.craftBridgeConflict);
  const clearCraftBridgeConflict = useEditorStore((s) => s.clearCraftBridgeConflict);
  const link = useEditorStore((s) => s.codeRoundTripLink);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const designTokens = useEditorStore((s) => s.designTokens);
  const assets = useEditorStore((s) => s.assets);
  const fileName = useEditorStore((s) => s.fileName);
  const sourceHeader = useEditorStore((s) => s.codeRoundTripSourceHeader);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);
  const importFromSource = useImportFromLinkedSource();

  if (!conflict || !link) return null;

  const onUseSource = async () => {
    setDiffOpen(false);
    await importFromSource();
  };

  const onKeepCanvas = async () => {
    setDiffOpen(false);
    setCraftBridgeSyncStatus("syncing", null);
    const result = await syncSourceToLinkedFile({
      nodes,
      childOrder,
      selectedIds,
      designTokens,
      assets,
      fileName,
      sourceHeader,
      link,
      explicitUserExport: true,
    });
    if (!result.ok) {
      setCraftBridgeSyncStatus("error", result.error);
      return;
    }
    updateCodeRoundTripLink({
      lastSyncedAt: result.writtenAt,
      lastExportedHash: result.hash,
      lastImportedHash: result.hash,
    });
    clearCraftBridgeConflict();
    setCraftBridgeSyncStatus("synced", null);
  };

  return (
    <>
      <CraftBridgeConflictModal
        open={diffOpen}
        sourcePath={link.sourcePath}
        sourceContent={conflict.sourceContent}
        canvasContent={conflict.canvasContent}
        onClose={() => setDiffOpen(false)}
      />
      <div
        className="pointer-events-auto fixed bottom-4 left-1/2 z-[240] flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border border-amber-500/40 bg-[#2a2418] px-4 py-3 shadow-2xl"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-ui font-semibold text-amber-100">Sync conflict</p>
          <p className="text-ui text-amber-100/80">
            Both <span className="font-medium">{link.sourcePath}</span> and the canvas changed.
            Review the diff, then choose which version to keep.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDiffOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-ui font-medium text-amber-50 hover:bg-amber-500/20"
            >
              <GitCompare className="h-3.5 w-3.5" />
              View diff
            </button>
            <button
              type="button"
              onClick={() => void onUseSource()}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-ui font-medium text-amber-50 hover:bg-amber-500/30"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Use source file
            </button>
            <button
              type="button"
              onClick={() => void onKeepCanvas()}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-ui font-medium text-amber-50 hover:bg-amber-500/30"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Keep canvas
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => clearCraftBridgeConflict()}
          className="rounded p-1 text-amber-200/70 hover:bg-amber-500/20 hover:text-amber-50"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
