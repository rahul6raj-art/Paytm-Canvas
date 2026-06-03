"use client";

import { Code2, Figma, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

const importOptionClass =
  "group flex flex-col items-start gap-3 rounded-xl border border-app-border bg-app-raised p-6 text-left shadow-sm transition-all hover:border-app-border hover:bg-app-hover hover:shadow-md";

export function ImportHub() {
  const open = useEditorStore((s) => s.importHubOpen);
  const closeImportHub = useEditorStore((s) => s.closeImportHub);
  const openImportWebModal = useEditorStore((s) => s.openImportWebModal);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);

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
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-app-border-subtle px-6 py-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-app-fg">Import design</h2>
            <p className="mt-1 text-[13px] text-app-muted">
              Bring external designs into Paytm Canvas as editable layers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => openImportFigmaModal()}
            className={cn(importOptionClass, "hover:border-orange-500/25")}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-app-fg text-app-bg">
              <Figma className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-app-fg">Import from Figma</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-app-muted">
                Turn Figma designs into interactive components
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openImportWebModal()}
            className={cn(importOptionClass, "hover:border-sky-500/30")}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Globe className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-app-fg">Import from Web</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-app-muted">
                Capture website elements into Paytm Canvas
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openCodeRoundTrip("import")}
            className={cn(importOptionClass, "hover:border-violet-500/30")}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Code2 className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-app-fg">Design ↔ Code</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-app-muted">
                Capture live React from Storybook, edit on canvas, export code
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
