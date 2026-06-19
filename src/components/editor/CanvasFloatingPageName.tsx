"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Home, Plus, X } from "lucide-react";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import {
  COMMENTS_PANEL_WIDTH,
  readLeftSidebarWidth,
  readRightPanelWidth,
} from "@/lib/sidebarPanelWidths";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import { EditorHintWrap } from "./EditorHoverHint";

const COLLAPSED_LEFT_CHROME_PX = 48;

const floatingIconButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ui transition-colors hover:bg-app-hover hover:text-app-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent";

const floatingHomeIconClass = "size-icon-ui shrink-0";

function floatingHomeControlClass(selected: boolean) {
  return cn(
    floatingIconButtonClass,
    "box-border border",
    selected
      ? "chrome-segmented-tab-active text-app-fg"
      : "border-transparent text-app-muted",
  );
}

const pageTabClass =
  "chrome-segmented-tab inline-flex h-8 max-w-[min(160px,28vw)] min-w-0 items-center gap-0.5 rounded-lg pl-2 pr-1 text-ui-sm focus-within:outline-none focus-within:ring-1 focus-within:ring-accent";

const pageTabNameButtonClass =
  "min-w-0 flex-1 truncate rounded-md py-0.5 pl-0 pr-0.5 text-left focus-visible:outline-none";

const pageTabCloseButtonClass =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent";

function pageTabHintLabel(pageName: string, isActive: boolean, singlePage: boolean): string {
  if (isActive) {
    return singlePage ? "Click to rename" : "Double-click to rename";
  }
  return `Switch to ${pageName}`;
}

function pageTabAriaLabel(pageName: string, isActive: boolean, singlePage: boolean): string {
  if (isActive) {
    return singlePage
      ? `Page: ${pageName}. Click to rename.`
      : `Page: ${pageName}. Double-click to rename.`;
  }
  return `Page: ${pageName}. Click to switch.`;
}

function closePageHintLabel(): string {
  return "Close page";
}

function closePageAriaLabel(pageName: string): string {
  return `Close ${pageName}. Page is saved to Dashboard.`;
}

export function CanvasFloatingPageName({
  leftSidebarVisible = true,
  leftChromeWidthPx,
  rightChromeWidthPx,
}: {
  leftSidebarVisible?: boolean;
  /** Override measured left sidebar width (e.g. fixed dashboard aside). */
  leftChromeWidthPx?: number;
  /** Override measured right chrome width (e.g. dashboard actions card only). */
  rightChromeWidthPx?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/";
  const activePageId = useEditorStore((s) => s.activePageId);
  const pageOrder = useEditorStore((s) => s.pageOrder);
  const pages = useEditorStore((s) => s.pages);
  const renamePage = useEditorStore((s) => s.renamePage);
  const addPage = useEditorStore((s) => s.addPage);
  const closePage = useEditorStore((s) => s.closePage);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const uiChromeVisible = useEditorStore((s) => s.uiChromeVisible);
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);

  const [renamePageId, setRenamePageId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savedPageId, setSavedPageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const renamePageIdRef = useRef(renamePageId);
  const savedAckTimerRef = useRef<number | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [dashboardChromeInsets, setDashboardChromeInsets] = useState<{
    left: number;
    right: number;
  } | null>(null);

  draftRef.current = draft;
  renamePageIdRef.current = renamePageId;

  useEffect(() => {
    if (!renamePageId) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [renamePageId]);

  useEffect(() => {
    return () => {
      if (savedAckTimerRef.current != null) {
        window.clearTimeout(savedAckTimerRef.current);
      }
    };
  }, []);

  const showSavedAck = useCallback((pageId: string) => {
    setSavedPageId(pageId);
    if (savedAckTimerRef.current != null) {
      window.clearTimeout(savedAckTimerRef.current);
    }
    savedAckTimerRef.current = window.setTimeout(() => {
      setSavedPageId(null);
      savedAckTimerRef.current = null;
    }, 2000);
  }, []);

  const startRename = useCallback((pageId: string) => {
    const page = pages[pageId];
    if (!page) return;
    renamePageIdRef.current = pageId;
    setDraft(page.name);
    setRenamePageId(pageId);
  }, [pages]);

  const commitRename = useCallback(() => {
    const pageId = renamePageIdRef.current;
    if (!pageId) return;
    renamePageIdRef.current = null;
    setRenamePageId(null);

    const trimmed = draftRef.current.trim();
    const previousName = useEditorStore.getState().pages[pageId]?.name ?? "";
    if (!trimmed || trimmed === previousName) return;

    renamePage(pageId, trimmed);
    if (useEditorStore.getState().pages[pageId]?.name === trimmed) {
      showSavedAck(pageId);
    }
  }, [renamePage, showSavedAck]);

  const cancelRename = useCallback(() => {
    renamePageIdRef.current = null;
    setRenamePageId(null);
  }, []);

  const onClosePage = useCallback(
    (pageId: string) => {
      const { emptied } = closePage(pageId);
      if (emptied) {
        router.push("/");
      }
    },
    [closePage, router],
  );

  useEffect(() => {
    if (!renamePageId) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root?.contains(e.target as Node)) return;
      commitRename();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [renamePageId, commitRename]);

  useEffect(() => {
    const onResize = () => setLayoutTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isDashboard) router.prefetch("/");
  }, [isDashboard, router]);

  useLayoutEffect(() => {
    if (!isDashboard) {
      setDashboardChromeInsets(null);
      return;
    }

    const measureDashboardChrome = () => {
      const aside = document.querySelector("[data-dashboard-aside]");
      const actions = document.querySelector("[data-dashboard-right-actions]");
      if (!actions) return;

      const actionsRect = actions.getBoundingClientRect();
      const left =
        leftSidebarVisible && aside
          ? Math.max(0, Math.round(aside.getBoundingClientRect().right))
          : COLLAPSED_LEFT_CHROME_PX;

      setDashboardChromeInsets({
        left,
        right: Math.max(0, Math.round(window.innerWidth - actionsRect.left)),
      });
    };

    measureDashboardChrome();
    const ro = new ResizeObserver(measureDashboardChrome);
    const aside = document.querySelector("[data-dashboard-aside]");
    const actions = document.querySelector("[data-dashboard-right-actions]");
    if (aside) ro.observe(aside);
    if (actions) ro.observe(actions);
    window.addEventListener("resize", measureDashboardChrome);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureDashboardChrome);
    };
  }, [isDashboard, layoutTick, leftSidebarVisible]);

  const style = useMemo(() => {
    void layoutTick;

    if (isDashboard) {
      if (dashboardChromeInsets) {
        return {
          left: dashboardChromeInsets.left,
          right: dashboardChromeInsets.right,
          top: 8,
        };
      }
      return {
        left: leftSidebarVisible ? 352 : COLLAPSED_LEFT_CHROME_PX,
        right: 280,
        top: 8,
      };
    }

    const rightChrome =
      rightChromeWidthPx ??
      readRightPanelWidth(rightPanelTab === "code") +
        (commentsPanelOpen ? COMMENTS_PANEL_WIDTH : 0);
    const leftChrome =
      leftChromeWidthPx ??
      (leftSidebarVisible ? readLeftSidebarWidth() : COLLAPSED_LEFT_CHROME_PX);

    return {
      left: leftChrome,
      right: rightChrome,
      top: 8,
    };
  }, [
    isDashboard,
    dashboardChromeInsets,
    layoutTick,
    leftSidebarVisible,
    leftChromeWidthPx,
    rightChromeWidthPx,
    commentsPanelOpen,
    rightPanelTab,
  ]);

  if (!uiChromeVisible || pageOrder.length === 0) return null;

  const singlePage = pageOrder.length === 1;

  return (
    <div
      className="pointer-events-none fixed z-40 flex justify-center"
      style={style}
    >
      <div
        ref={rootRef}
        className="pointer-events-auto"
        data-canvas-floating-page-name
      >
      <div
        className={cn(
          "editor-sidebar-section inline-flex max-w-[min(560px,72vw)] shrink-0 items-center gap-1 px-2.5 py-1.5",
          "bg-app-panel/95 shadow-float backdrop-blur-sm",
        )}
      >
        <EditorHintWrap hintLabel="Go to Dashboard" hintSide="bottom">
          {isDashboard ? (
            <button
              type="button"
              aria-label="Dashboard"
              aria-current="page"
              className={floatingHomeControlClass(true)}
            >
              <Home className={floatingHomeIconClass} strokeWidth={2} />
            </button>
          ) : (
            <Link
              href="/"
              prefetch
              aria-label="Go to Dashboard"
              className={floatingHomeControlClass(false)}
            >
              <Home className={floatingHomeIconClass} strokeWidth={2} />
            </Link>
          )}
        </EditorHintWrap>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-app-panel-edge" aria-hidden />

        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-xl bg-app-inset p-0.5">
          {pageOrder.map((pageId) => {
            const page = pages[pageId];
            if (!page) return null;
            const isActive = !isDashboard && pageId === activePageId;
            const isRenaming = renamePageId === pageId;
            const showSaved = savedPageId === pageId && !isRenaming;

            if (isRenaming) {
              return (
                <div
                  key={pageId}
                  className="inline-flex shrink-0 items-center rounded-[8px] px-1 py-0.5 ring-1 ring-accent/35"
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    data-page-name-editor
                    aria-label="Page name"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      window.requestAnimationFrame(() => commitRename());
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handlePanelFieldKeyDown(e, {
                        onEnter: () => commitRename(),
                        onEscape: () => cancelRename(),
                      });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "block min-w-[3.5rem] max-w-[min(160px,28vw)] rounded-md border border-app-border-subtle",
                      "bg-app-inset px-2 py-0.5 text-ui-sm font-medium text-app-fg outline-none",
                      "focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent",
                    )}
                    size={Math.max(6, Math.min(20, draft.length + 1))}
                  />
                </div>
              );
            }

            return (
              <div
                key={pageId}
                className={cn(
                  pageTabClass,
                  isActive
                    ? "chrome-segmented-tab-active"
                    : "text-app-muted hover:bg-app-hover hover:text-app-fg",
                )}
              >
                <EditorHintWrap
                  hintLabel={pageTabHintLabel(page.name, isActive, singlePage)}
                  hintSide="bottom"
                  className="inline-flex min-w-0 flex-1"
                >
                  <button
                    type="button"
                    aria-label={pageTabAriaLabel(page.name, isActive, singlePage)}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      if (isDashboard) {
                        if (pageId !== activePageId) setActivePage(pageId);
                        router.push("/editor");
                        return;
                      }
                      if (isActive && singlePage) {
                        startRename(pageId);
                        return;
                      }
                      if (pageId !== activePageId) setActivePage(pageId);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      startRename(pageId);
                    }}
                    className={pageTabNameButtonClass}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1 truncate">
                      <span className="truncate">{page.name}</span>
                      {showSaved ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-ui text-emerald-500">
                          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </EditorHintWrap>
                <EditorHintWrap hintLabel={closePageHintLabel()} hintSide="bottom">
                  <button
                    type="button"
                    aria-label={closePageAriaLabel(page.name)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClosePage(pageId);
                    }}
                    className={pageTabCloseButtonClass}
                  >
                    <X className="h-3 w-3" strokeWidth={2.25} />
                  </button>
                </EditorHintWrap>
              </div>
            );
          })}
        </div>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-app-panel-edge" aria-hidden />

        <EditorHintWrap hintLabel="Add master page" hintSide="bottom">
          <button
            type="button"
            aria-label="Add master page"
            onClick={() => addPage()}
            className={cn(floatingIconButtonClass, "text-app-muted")}
          >
            <Plus className={floatingHomeIconClass} strokeWidth={2} />
          </button>
        </EditorHintWrap>
      </div>
      </div>
    </div>
  );
}
