"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FIG_IMPORT_OVERLAY_WATCHDOG_MS } from "@/lib/figImport/figImportConstants";
import { useEditorStore } from "@/stores/useEditorStore";
import { FigmaLogoMark } from "@/components/import/FigmaLogoMark";

export function FigImportOverlay() {
  const busy = useEditorStore((s) => s.figImportInProgress);
  const status = useEditorStore((s) => s.figImportStatus);
  const resetEditorBlockingState = useEditorStore((s) => s.resetEditorBlockingState);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const tick = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    const watchdog = window.setTimeout(() => {
      const st = useEditorStore.getState();
      if (!st.figImportInProgress) return;
      resetEditorBlockingState();
      window.alert(
        "Figma import took too long and was stopped. Try a single frame link (⌘L in Figma) or a smaller .fig file.",
      );
    }, FIG_IMPORT_OVERLAY_WATCHDOG_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(watchdog);
    };
  }, [busy, resetEditorBlockingState]);

  if (!busy) return null;

  const detail =
    status ??
    "Preparing your design… Large files can take a few minutes — please keep this tab open.";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[230] flex items-center justify-center bg-black/60 px-4 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Importing from Figma"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-app-border bg-app-panel px-6 py-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center">
          <FigmaLogoMark className="h-16 w-16 object-contain" />
        </div>
        <div className="mb-3 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden />
          <p className="text-[15px] font-semibold text-app-fg">Importing from Figma</p>
        </div>
        <p className="text-[13px] leading-relaxed text-app-muted">{detail}</p>
        {elapsedSec >= 5 ? (
          <p className="mt-2 text-[12px] tabular-nums text-app-subtle">
            {elapsedSec}s elapsed · keep this tab open
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-app-subtle">Keep this tab open until import finishes.</p>
        )}
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-app-inset">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-accent" />
        </div>
        <button
          type="button"
          className="mt-4 text-[12px] font-medium text-app-subtle underline-offset-2 hover:text-app-fg hover:underline"
          onClick={() => {
            resetEditorBlockingState();
          }}
        >
          Cancel import
        </button>
      </div>
    </div>
  );
}
