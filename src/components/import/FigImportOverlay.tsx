"use client";

import { useEditorStore } from "@/stores/useEditorStore";

export function FigImportOverlay() {
  const busy = useEditorStore((s) => s.figImportInProgress);
  if (!busy) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 max-w-sm rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-xl">
        <p className="text-[14px] font-semibold text-slate-900">Importing Figma file</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          Parsing and converting layers in the background. Large .fig files can take a minute — the
          editor will stay responsive.
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-500" />
        </div>
      </div>
    </div>
  );
}
