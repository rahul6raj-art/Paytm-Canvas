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
      ? { label: "Draft", className: "border-app-border bg-app-inset text-app-fg" }
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
        "flex flex-col overflow-hidden rounded-xl border border-app-border-subtle bg-app-card",
        "transition-colors hover:border-app-border hover:shadow-md",
      )}
    >
      <div
        className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden border-b border-app-border-subtle"
        style={{ background: accent }}
        onClick={onOpen}
        role="presentation"
      >
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <FileBadge kind={fileBadge} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/[0.08] dark:bg-black/20">
          <LayoutTemplate className="h-10 w-10 text-white/90 drop-shadow-sm" strokeWidth={1.25} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="truncate text-[13px] font-semibold text-app-fg">{name}</h3>
          <p className="mt-0.5 text-[11px] font-medium text-app-muted">{workspaceName}</p>
          <p className="mt-0.5 text-[12px] text-app-muted">Edited {lastEdited}</p>
        </button>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-inset text-[10px] font-bold text-app-fg"
              title={ownerName}
            >
              {ownerInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-app-fg">{ownerName}</p>
              <p className="text-[10px] text-app-muted">Owner</p>
            </div>
            {stack.length > 0 ? (
              <div className="ml-1 flex shrink-0 -space-x-2" title={`Shared with ${stack.join(", ")}`}>
                {stack.map((ini) => (
                  <span
                    key={ini}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-app-card bg-indigo-100 text-[9px] font-bold text-indigo-900 shadow-sm dark:bg-indigo-950/80 dark:text-indigo-200"
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
            className="shrink-0 rounded-lg border border-app-border-subtle bg-app-card px-2.5 py-1 text-[12px] font-medium text-app-fg transition-colors hover:border-app-border hover:bg-app-raised"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
