"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/stores/useEditorStore";

export function ImportNoticeToast() {
  const notice = useEditorStore((s) => s.svgImportNotice);
  const clear = useEditorStore((s) => s.clearSvgImportNotice);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => clear(), 12_000);
    return () => window.clearTimeout(t);
  }, [notice, clear]);

  if (!notice) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[200] max-w-lg -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/95 px-4 py-3 text-ui-sm text-amber-50 shadow-lg"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{notice.title}</p>
          {notice.details.length > 0 ? (
            <ul className="mt-1.5 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4 text-ui text-amber-100/90">
              {notice.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded px-2 py-0.5 text-ui text-amber-200 hover:bg-amber-800/60"
          onClick={() => clear()}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
