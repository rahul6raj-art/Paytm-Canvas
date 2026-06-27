"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isColorValue, resolvedColorForMode } from "@/lib/designTokens";
import { useCanvasColorMode } from "@/hooks/useCanvasColorMode";
import { cn } from "@/lib/utils";
import { getGroupedColorDesignTokens } from "./LibraryColorPickerMenu";
import { EditorHintWrap } from "./EditorHoverHint";

type ColorLibraryView = "grid" | "list";

type ColorLibraryPickerBodyProps = {
  activeTokenId?: string | null;
  onPick: (tokenId: string) => void;
  /** Compact 6-col grid for inline panels; roomier 5-col for dialogs. */
  gridCols?: "compact" | "panel";
  listMaxHeightClass?: string;
  /** When false, list grows with content and parent handles scrolling (dialog mode). */
  listScrollContained?: boolean;
  showHeader?: boolean;
  showViewToggle?: boolean;
  /** When set, view is controlled by the parent (e.g. dialog header toggle). */
  viewOverride?: ColorLibraryView;
  /** Bump when dialog opens to re-scroll the active token into view. */
  scrollActiveKey?: unknown;
  className?: string;
};

export function ColorLibraryPickerBody({
  activeTokenId,
  onPick,
  gridCols = "panel",
  listMaxHeightClass = "max-h-64",
  listScrollContained = true,
  showHeader = false,
  showViewToggle = true,
  viewOverride,
  scrollActiveKey,
  className,
}: ColorLibraryPickerBodyProps) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const colorMode = useCanvasColorMode();
  const [internalView, setInternalView] = useState<ColorLibraryView>("grid");
  const activeGridRef = useRef<HTMLButtonElement>(null);
  const activeListRef = useRef<HTMLButtonElement>(null);
  const view = viewOverride ?? internalView;
  const setView = viewOverride ? () => undefined : setInternalView;

  const groups = useMemo(() => getGroupedColorDesignTokens(designTokens), [designTokens]);
  const colors = useMemo(
    () => groups.flatMap((g) => g.tokens),
    [groups],
  );
  const canApply = selectedIds.length > 0;

  useLayoutEffect(() => {
    if (!activeTokenId) return;
    const target = view === "list" ? activeListRef.current : activeGridRef.current;
    target?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [activeTokenId, view, scrollActiveKey, colors.length]);

  if (colors.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-ui leading-snug text-app-subtle">
        No colors in the library yet. Open the Library panel to add a palette or create colors.
      </p>
    );
  }

  const gridClass =
    gridCols === "compact" ? "grid grid-cols-6 gap-1" : "grid grid-cols-5 gap-1.5";

  const applyButtonClass = (active: boolean) =>
    cn(
      canApply ? "cursor-pointer hover:bg-app-hover" : "cursor-not-allowed opacity-50",
      active &&
        "bg-app-inset text-app-fg ring-1 ring-app-panel-edge hover:bg-app-inset",
    );

  const viewToggle = showViewToggle ? (
    <div
      className="flex items-center rounded border border-app-border bg-app-inset p-0.5"
      role="group"
      aria-label="Color library view"
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

  const sectionHeadingClass = "mb-1.5 px-0.5 text-ui font-semibold text-app-subtle";

  return (
    <div className={className}>
      {showHeader || showViewToggle ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          {showHeader ? (
            <span className="text-ui font-medium text-app-subtle">Color library</span>
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
        <div className="space-y-3">
          {groups.map((group) => (
            <section key={group.id}>
              <h4 className={sectionHeadingClass}>{group.label}</h4>
              <div className={gridClass}>
                {group.tokens.map((token) => {
                  const raw = token.value;
                  if (!isColorValue(raw)) return null;
                  const v = resolvedColorForMode(raw, colorMode);
                  const active = activeTokenId === token.id;
                  return (
                    <EditorHintWrap
                      key={token.id}
                      title={`${token.name} · ${v.hex}`}
                      disabled={!canApply}
                    >
                      <button
                        ref={active ? activeGridRef : undefined}
                        type="button"
                        disabled={!canApply}
                        aria-selected={active}
                        onClick={() => onPick(token.id)}
                        className={cn(
                          "group relative aspect-square min-h-[28px] rounded-md border transition-all",
                          canApply ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-not-allowed opacity-50",
                          active
                            ? "border-accent ring-2 ring-accent/50 scale-105 shadow-md"
                            : "border-white/[0.15] hover:border-white/30",
                        )}
                        style={{
                          backgroundColor: v.hex,
                          opacity: v.opacity ?? 1,
                        }}
                      >
                        <span className="sr-only">{token.name}</span>
                      </button>
                    </EditorHintWrap>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            listScrollContained && "thin-scroll overflow-y-auto",
            listScrollContained && listMaxHeightClass,
          )}
        >
          {groups.map((group, groupIndex) => (
            <section key={group.id} className={groupIndex > 0 ? "mt-3 border-t border-app-border-subtle pt-3" : ""}>
              <h4 className={sectionHeadingClass}>{group.label}</h4>
              <ul className="space-y-0.5">
                {group.tokens.map((token) => {
                  const raw = token.value;
                  if (!isColorValue(raw)) return null;
                  const v = resolvedColorForMode(raw, colorMode);
                  const active = activeTokenId === token.id;
                  return (
                    <li key={token.id}>
                      <EditorHintWrap title={`${token.name} · ${v.hex}`} disabled={!canApply}>
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
                              "h-5 w-5 shrink-0 rounded border border-white/[0.15]",
                              active && "border-accent ring-1 ring-accent/50",
                            )}
                            style={{
                              backgroundColor: v.hex,
                              opacity: v.opacity ?? 1,
                            }}
                            aria-hidden
                          />
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
                            {v.hex}
                          </span>
                        </button>
                      </EditorHintWrap>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
