"use client";

import { useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatVersionWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function VersionHistoryPanel() {
  const open = useEditorStore((s) => s.versionHistoryOpen);
  const closeVersionHistory = useEditorStore((s) => s.closeVersionHistory);
  const apiVersionsStatus = useEditorStore((s) => s.apiVersionsStatus);
  const apiFileVersions = useEditorStore((s) => s.apiFileVersions);
  const loadApiFileVersions = useEditorStore((s) => s.loadApiFileVersions);
  const createApiFileVersion = useEditorStore((s) => s.createApiFileVersion);
  const restoreApiFileVersion = useEditorStore((s) => s.restoreApiFileVersion);

  const [nameDraft, setNameDraft] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setNameDraft("");
      setCreating(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close version history"
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={() => closeVersionHistory()}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[70] flex h-dvh w-[min(100%,380px)] flex-col border-l border-white/[0.08] bg-[#1e1e1e] shadow-2xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.08] px-3">
          <History className="h-4 w-4 text-[#a3a3a3]" strokeWidth={2} />
          <h2 id="version-history-title" className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#ececec]">
            Version history
          </h2>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#b8b8b8] hover:bg-white/[0.08] hover:text-white"
            aria-label="Close"
            onClick={() => closeVersionHistory()}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="border-b border-white/[0.06] p-3">
          <p className="mb-2 text-[11px] leading-relaxed text-[#9a9a9a]">
            Save a named snapshot of this file to the mock API. Restoring updates the API file and your local backup.
          </p>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
            Version name (optional)
          </label>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="e.g. Before layout refactor"
            className="mb-2 h-9 w-full rounded-md border border-white/[0.1] bg-black/30 px-2.5 text-[12px] text-[#ececec] outline-none placeholder:text-[#6b6b6b] focus:border-[#0d99ff]/50"
          />
          <Button
            type="button"
            variant="primary"
            className="h-8 w-full text-[12px]"
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              try {
                const n = nameDraft.trim();
                await createApiFileVersion(n || undefined);
                setNameDraft("");
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </span>
            ) : (
              "Create version"
            )}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7a7a7a]">Snapshots</span>
            <button
              type="button"
              className="text-[10px] font-medium text-[#0d99ff] hover:underline"
              onClick={() => void loadApiFileVersions()}
            >
              Refresh
            </button>
          </div>

          {apiVersionsStatus === "loading" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-[12px] text-[#9a9a9a]">
              <Loader2 className="h-6 w-6 animate-spin text-[#0d99ff]" />
              Loading versions…
            </div>
          ) : null}

          {apiVersionsStatus === "failed" ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-2 text-[11px] text-red-200/95">
              Could not load versions. Try Refresh or check the mock API.
            </p>
          ) : null}

          {apiVersionsStatus === "synced" && apiFileVersions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center">
              <History className="mx-auto mb-2 h-8 w-8 text-[#4a4a4a]" strokeWidth={1.25} />
              <p className="text-[12px] font-medium text-[#9a9a9a]">No saved versions</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6b6b6b]">
                Name a snapshot above and choose <span className="font-medium text-[#8c8c8c]">Create version</span> to
                store the current document on the mock API. You can restore any snapshot later.
              </p>
            </div>
          ) : null}

          {apiVersionsStatus === "synced" && apiFileVersions.length > 0 ? (
            <ul className="space-y-2">
              {apiFileVersions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-white/[0.08] bg-black/20 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <div className="mb-1 text-[12px] font-medium text-[#ececec]">{v.name}</div>
                  <div className="mb-2 text-[10px] text-[#8c8c8c]">
                    {formatVersionWhen(v.createdAt)} · {v.createdByDisplayName}
                  </div>
                  <Button
                    type="button"
                    variant="toolbar"
                    className="h-7 w-full text-[11px]"
                    onClick={() => void restoreApiFileVersion(v.id)}
                  >
                    Restore this version
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </aside>
    </>
  );
}
