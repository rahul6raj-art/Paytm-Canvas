"use client";

import { LayoutTemplate, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
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
  onDelete?: () => void;
}

function FileBadge({ kind }: { kind: DashboardFileBadge }) {
  const cfg =
    kind === "draft"
      ? { label: "Draft", className: "border-app-border-subtle bg-app-inset text-app-muted" }
      : kind === "team"
        ? { label: "Team", className: "border-app-border-subtle bg-app-inset text-app-fg" }
        : { label: "Template", className: "border-app-border-subtle bg-app-inset text-app-fg" };
  return (
    <span className={cn("rounded-md border px-1.5 py-0.5 text-ui font-medium", cfg.className)}>
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
  onDelete,
}: FileCardProps) {
  const stack = sharedInitials.slice(0, 4);
  return (
    <div
      className={cn(
        "editor-sidebar-section flex flex-col overflow-hidden shadow-none transition-colors",
        "hover:border-app-border",
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
        {onDelete ? (
          <EditorHintWrap title="Delete file" anchorClassName="contents">
            <button
              type="button"
              aria-label={`Delete ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-black/30 text-white/90 backdrop-blur-sm transition-colors hover:bg-red-600/90"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </EditorHintWrap>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/[0.08] dark:bg-black/20">
          <LayoutTemplate className="h-10 w-10 text-white/90 drop-shadow-sm" strokeWidth={1.25} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="truncate text-ui font-semibold text-app-fg">{name}</h3>
          <p className="mt-0.5 text-ui text-app-muted">{workspaceName}</p>
          <p className="mt-0.5 text-ui text-app-subtle">Edited {lastEdited}</p>
        </button>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <EditorHintWrap title={ownerName}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-app-border-subtle bg-app-inset text-ui font-bold text-app-fg">
                {ownerInitials}
              </span>
            </EditorHintWrap>
            <div className="min-w-0">
              <p className="truncate text-ui font-medium text-app-fg">{ownerName}</p>
              <p className="text-ui text-app-subtle">Owner</p>
            </div>
            {stack.length > 0 ? (
              <EditorHintWrap title={`Shared with ${stack.join(", ")}`}>
                <div className="ml-1 flex shrink-0 -space-x-2">
                  {stack.map((ini) => (
                    <span
                      key={ini}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-app-panel bg-app-inset text-ui font-bold text-app-fg"
                    >
                      {ini}
                    </span>
                  ))}
                </div>
              </EditorHintWrap>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-lg border border-app-border-subtle bg-app-inset px-2.5 py-1 text-ui font-medium text-app-fg transition-colors hover:border-app-border hover:bg-app-hover"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
