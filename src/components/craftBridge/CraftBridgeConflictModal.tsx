"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { alignDiffSides, countDiffStats } from "@paytm-craft/bridge/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  sourcePath: string;
  sourceContent: string;
  canvasContent: string;
  onClose: () => void;
};

function rowClass(kind: "same" | "change" | "left-only" | "right-only", side: "left" | "right") {
  if (kind === "same") return "text-app-subtle/80";
  if (kind === "change") return side === "left" ? "bg-red-500/15 text-red-100" : "bg-emerald-500/15 text-emerald-100";
  if (kind === "left-only" && side === "left") return "bg-red-500/20 text-red-100";
  if (kind === "right-only" && side === "right") return "bg-emerald-500/20 text-emerald-100";
  return "text-transparent select-none";
}

export function CraftBridgeConflictModal({
  open,
  sourcePath,
  sourceContent,
  canvasContent,
  onClose,
}: Props) {
  const rows = useMemo(
    () => alignDiffSides(sourceContent, canvasContent),
    [sourceContent, canvasContent],
  );
  const stats = useMemo(() => countDiffStats(rows), [rows]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Sync conflict diff"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-[#1a1a1c] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">Conflict diff</h2>
            <p className="text-ui text-app-subtle">
              {sourcePath} · {stats.changed} changed · {stats.leftOnly + stats.rightOnly} lines
              only on one side
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-app-subtle hover:bg-app-hover hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-app-border bg-app-border text-ui font-semibold text-app-fg">
          <div className="bg-[#141416] px-3 py-2">Source file</div>
          <div className="bg-[#141416] px-3 py-2">Canvas export</div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-auto font-mono text-[11px] leading-5">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-px bg-app-border/40">
              <pre
                className={cn(
                  "min-h-[1.25rem] whitespace-pre-wrap break-all bg-[#121214] px-3 py-0.5",
                  rowClass(row.kind, "left"),
                )}
              >
                {row.left ?? " "}
              </pre>
              <pre
                className={cn(
                  "min-h-[1.25rem] whitespace-pre-wrap break-all bg-[#121214] px-3 py-0.5",
                  rowClass(row.kind, "right"),
                )}
              >
                {row.right ?? " "}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
