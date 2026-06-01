"use client";

import { Figma, Globe, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";

export function ImportHub() {
  const open = useEditorStore((s) => s.importHubOpen);
  const closeImportHub = useEditorStore((s) => s.closeImportHub);
  const openImportWebModal = useEditorStore((s) => s.openImportWebModal);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);

  if (!open) return null;

  const onClose = () => closeImportHub();

  return (
    <div
      className="fixed inset-0 z-[215] flex items-center justify-center bg-black/55 px-4 py-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Import design"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">Import design</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Bring external designs into Paytm Canvas as editable layers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openImportFigmaModal()}
            className="group flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e1e1e] text-white">
              <Figma className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Import from Figma</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                Turn Figma designs into interactive components
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openImportWebModal()}
            className="group flex flex-col items-start gap-3 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 text-left shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Globe className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Import from Web</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                Capture website elements into Paytm Canvas
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
