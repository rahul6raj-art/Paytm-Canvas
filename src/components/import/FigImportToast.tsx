"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";

const TOAST_DISMISS_MS = 8_000;

export function FigImportToast() {
  const message = useEditorStore((s) => s.figImportToast);
  const setFigImportToast = useEditorStore((s) => s.setFigImportToast);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setFigImportToast(null), TOAST_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [message, setFigImportToast]);

  if (!message) return null;

  const isWarning = /not saved|very large|timed out/i.test(message);

  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[240] w-[min(92vw,28rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl ${
          isWarning
            ? "border-amber-500/40 bg-amber-950/90 text-amber-50"
            : "border-app-border bg-app-panel text-app-fg"
        }`}
      >
        <CheckCircle2
          className={`mt-0.5 h-5 w-5 shrink-0 ${isWarning ? "text-amber-400" : "text-emerald-500"}`}
          aria-hidden
        />
        <p className="flex-1 text-ui-sm leading-relaxed">{message}</p>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-app-subtle hover:bg-app-hover hover:text-app-fg"
          aria-label="Dismiss"
          onClick={() => setFigImportToast(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
