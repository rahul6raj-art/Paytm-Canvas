"use client";

import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardFileBadge } from "@/lib/templates";

export interface FileCardProps {
  name: string;
  lastEdited: string;
  ownerName: string;
  ownerInitials: string;
  workspaceName: string;
  sharedInitials: string[];
  fileBadge: DashboardFileBadge;
  accent: string;
  onOpen: () => void;
}

function FileBadge({ kind }: { kind: DashboardFileBadge }) {
  const cfg =
    kind === "draft"
      ? { label: "Draft", className: "border-slate-200 bg-slate-100 text-slate-700" }
      : kind === "team"
        ? { label: "Team", className: "border-sky-200 bg-sky-50 text-sky-900" }
        : { label: "Template", className: "border-violet-200 bg-violet-50 text-violet-900" };
  return (
    <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cfg.className)}>
      {cfg.label}
    </span>
  );
}

export function FileCard({
  name,
  lastEdited,
  ownerName,
  ownerInitials,
  workspaceName,
  sharedInitials,
  fileBadge,
  accent,
  onOpen,
}: FileCardProps) {
  const stack = sharedInitials.slice(0, 4);
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
        "transition-shadow hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div
        className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden border-b border-slate-100"
        style={{ background: accent }}
        onClick={onOpen}
        role="presentation"
      >
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <FileBadge kind={fileBadge} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/[0.06]">
          <LayoutTemplate className="h-10 w-10 text-white/90 drop-shadow-sm" strokeWidth={1.25} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="truncate text-[13px] font-semibold text-slate-900">{name}</h3>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">{workspaceName}</p>
          <p className="mt-0.5 text-[12px] text-slate-500">Edited {lastEdited}</p>
        </button>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-700"
              title={ownerName}
            >
              {ownerInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-slate-800">{ownerName}</p>
              <p className="text-[10px] text-slate-500">Owner</p>
            </div>
            {stack.length > 0 ? (
              <div className="ml-1 flex shrink-0 -space-x-2" title={`Shared with ${stack.join(", ")}`}>
                {stack.map((ini) => (
                  <span
                    key={ini}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[9px] font-bold text-indigo-900 shadow-sm"
                  >
                    {ini}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
