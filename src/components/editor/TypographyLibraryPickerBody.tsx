"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isTypographyValue } from "@/lib/designTokens";
import { cn } from "@/lib/utils";
import {
  getTypographyDesignTokens,
  typographyTokenSummary,
} from "./LibraryTypographyPickerMenu";
import { EditorHintWrap } from "./EditorHoverHint";

type TypographyLibraryView = "grid" | "list";

type TypographyLibraryPickerBodyProps = {
  activeTokenId?: string | null;
  onPick: (tokenId: string) => void;
  listScrollContained?: boolean;
  listMaxHeightClass?: string;
  showHeader?: boolean;
  showViewToggle?: boolean;
  viewOverride?: TypographyLibraryView;
  scrollActiveKey?: unknown;
  className?: string;
};

export function TypographyLibraryPickerBody({
  activeTokenId,
  onPick,
  listScrollContained = true,
  listMaxHeightClass = "max-h-64",
  showHeader = false,
  showViewToggle = true,
  viewOverride,
  scrollActiveKey,
  className,
}: TypographyLibraryPickerBodyProps) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const [internalView, setInternalView] = useState<TypographyLibraryView>("list");
  const activeGridRef = useRef<HTMLButtonElement>(null);
  const activeListRef = useRef<HTMLButtonElement>(null);
  const view = viewOverride ?? internalView;
  const setView = viewOverride ? () => undefined : setInternalView;

  const styles = useMemo(() => getTypographyDesignTokens(designTokens), [designTokens]);
  const canApply = selectedIds.length > 0;

  useLayoutEffect(() => {
    if (!activeTokenId) return;
    const target = view === "list" ? activeListRef.current : activeGridRef.current;
    target?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [activeTokenId, view, scrollActiveKey, styles.length]);

  if (styles.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-ui leading-snug text-app-subtle">
        No text styles in the library yet. Import from project CSS or create one from the inspector.
      </p>
    );
  }

  const applyButtonClass = (active: boolean) =>
    cn(
      canApply ? "cursor-pointer hover:bg-app-hover" : "cursor-not-allowed opacity-50",
      active && "bg-app-inset text-app-fg ring-1 ring-app-panel-edge hover:bg-app-inset",
    );

  const viewToggle = showViewToggle ? (
    <div
      className="flex items-center rounded border border-app-border bg-app-inset p-0.5"
      role="group"
      aria-label="Text style library view"
    >
      <EditorHintWrap title="Grid view">
        <button
          type="button"
          aria-pressed={view === "grid"}
          onClick={() => setView("grid")}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded transition-colors",
            view === "grid"
              ? "bg-app-panel text-app-fg shadow-sm"
              : "text-app-subtle hover:text-app-fg",
          )}
        >
          <LayoutGrid className="h-3 w-3" strokeWidth={2} />
        </button>
      </EditorHintWrap>
      <EditorHintWrap title="List view with names">
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded transition-colors",
            view === "list"
              ? "bg-app-panel text-app-fg shadow-sm"
              : "text-app-subtle hover:text-app-fg",
          )}
        >
          <List className="h-3 w-3" strokeWidth={2} />
        </button>
      </EditorHintWrap>
    </div>
  ) : null;

  const previewStyle = (token: (typeof styles)[number]) => {
    const v = token.value;
    if (!isTypographyValue(v)) return {};
    return {
      fontFamily: v.fontFamily,
      fontSize: Math.min(v.fontSize, 16),
      fontWeight: v.fontWeight,
      lineHeight: 1.1,
      letterSpacing: `${v.letterSpacing}px`,
    } as const;
  };

  return (
    <div className={className}>
      {showHeader || showViewToggle ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          {showHeader ? (
            <span className="text-ui font-medium text-app-subtle">Text styles</span>
          ) : (
            <span className="text-ui text-app-subtle">{canApply ? "Click to apply" : "Select a layer"}</span>
          )}
          <div className="flex items-center gap-1.5">
            {viewToggle}
            {showHeader ? (
              !canApply ? (
                <span className="text-ui text-app-subtle">Select a layer</span>
              ) : (
                <span className="text-ui text-app-subtle">Click to apply</span>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {styles.map((token) => {
            const active = activeTokenId === token.id;
            return (
              <EditorHintWrap
                key={token.id}
                title={`${token.name} · ${typographyTokenSummary(token)}`}
              >
                <button
                  ref={active ? activeGridRef : undefined}
                  type="button"
                  disabled={!canApply}
                  aria-selected={active}
                  onClick={() => onPick(token.id)}
                  className={cn(
                    "flex min-h-[52px] flex-col items-start justify-between rounded-md border px-2 py-1.5 text-left transition-all",
                    canApply ? "cursor-pointer hover:bg-app-hover" : "cursor-not-allowed opacity-50",
                    active
                      ? "border-app-panel-edge bg-app-inset ring-1 ring-app-panel-edge"
                      : "border-app-border bg-app-surface hover:border-white/20",
                  )}
                >
                  <span
                    className={cn("truncate text-ui", active ? "font-medium text-app-fg" : "text-app-fg")}
                    style={previewStyle(token)}
                  >
                    Ag
                  </span>
                  <span className="mt-1 w-full truncate text-ui text-app-subtle">{token.name}</span>
                </button>
              </EditorHintWrap>
            );
          })}
        </div>
      ) : (
        <ul
          className={cn(
            "space-y-0.5",
            listScrollContained && "thin-scroll overflow-y-auto",
            listScrollContained && listMaxHeightClass,
          )}
        >
          {styles.map((token) => {
            const active = activeTokenId === token.id;
            return (
              <li key={token.id}>
                <EditorHintWrap title={`${token.name} · ${typographyTokenSummary(token)}`}>
                  <button
                    ref={active ? activeListRef : undefined}
                    type="button"
                    disabled={!canApply}
                    aria-selected={active}
                    onClick={() => onPick(token.id)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                    applyButtonClass(active),
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-8 shrink-0 items-center justify-center rounded border border-app-border bg-app-surface",
                      active && "border-accent ring-1 ring-accent/50",
                    )}
                    style={previewStyle(token)}
                    aria-hidden
                  >
                    Ag
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-ui",
                      active ? "font-medium text-app-fg" : "text-app-fg",
                    )}
                  >
                    {token.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-ui",
                      active ? "text-app-muted" : "text-app-subtle",
                    )}
                  >
                    {typographyTokenSummary(token)}
                  </span>
                </button>
                </EditorHintWrap>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
