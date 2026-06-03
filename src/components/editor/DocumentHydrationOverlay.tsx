"use client";

import { useEditorStore } from "@/stores/useEditorStore";

/** Shown while local document is parsed/hydrated so the tab does not look frozen. */
export function DocumentHydrationOverlay() {
  const hydrating = useEditorStore((s) => s.documentHydrating);
  if (!hydrating) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[199] flex items-center justify-center bg-slate-900/25"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 max-w-sm rounded-xl border border-app-border bg-app-bg px-6 py-5 shadow-xl">
        <p className="text-[14px] font-semibold text-app-fg">Loading your file…</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-app-muted">
          Restoring layers from browser storage. Very large files may take a few seconds.
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-app-inset">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-500" />
        </div>
      </div>
    </div>
  );
}
