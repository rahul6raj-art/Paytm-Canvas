"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortcutLabel } from "@/lib/commands";
import {
  buildResolvedLogoMenuRoot,
  buildResolvedSubmenuEntries,
  type ResolvedLogoMenuRootEntry,
  type ResolvedSubmenuEntry,
} from "@/lib/editorLogoMenuConfig";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
} from "../useAnchoredDropdown";

function MenuActionRow({
  label,
  shortcut,
  disabled,
  active,
  hasSubmenu,
  onClick,
  onSubmenuToggle,
  onMouseEnter,
  rowRef,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  hasSubmenu?: boolean;
  onClick?: () => void;
  onSubmenuToggle?: () => void;
  onMouseEnter?: () => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={rowRef}
      className={cn(
        "editor-menu-dropdown-item group",
        active && "bg-app-inset text-app-fg",
        disabled ? "cursor-not-allowed text-app-subtle" : "text-app-fg hover:bg-app-hover",
      )}
      onMouseEnter={onMouseEnter}
    >
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        className="min-w-0 flex-1 text-left"
        onClick={onClick}
      >
        <span className="truncate">{label}</span>
      </button>
      {shortcut ? (
        <span className="editor-menu-dropdown-shortcut">{formatShortcutLabel(shortcut)}</span>
      ) : null}
      {hasSubmenu ? (
        <button
          type="button"
          aria-label={`Open ${label} submenu`}
          aria-expanded={active}
          className={cn(
            "ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle transition-colors",
            active ? "bg-app-hover text-app-fg" : "hover:bg-app-hover hover:text-app-fg",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSubmenuToggle?.();
          }}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

function computeFlyoutPosition(anchorRect: DOMRect, width = 260) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const gap = 4;
  let left = anchorRect.right + gap;
  if (left + width > vw - pad) {
    left = Math.max(pad, anchorRect.left - width - gap);
  }
  const maxHeight = Math.min(420, vh - pad * 2);
  let top = anchorRect.top;
  if (top + maxHeight > vh - pad) {
    top = Math.max(pad, vh - pad - maxHeight);
  }
  return { left, top, maxHeight, width };
}

function MenuFlyoutPanel({
  entries,
  anchorRect,
  zIndex,
  onSelect,
  onNestedChange,
}: {
  entries: ResolvedSubmenuEntry[];
  anchorRect: DOMRect;
  zIndex: number;
  onSelect: () => void;
  onNestedChange?: (open: boolean) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const nestedRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeNestedId, setActiveNestedId] = useState<string | null>(null);
  const [nestedAnchorRect, setNestedAnchorRect] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState(() => computeFlyoutPosition(anchorRect));

  useLayoutEffect(() => {
    setPosition(computeFlyoutPosition(anchorRect));
  }, [anchorRect]);

  const openNested = useCallback((id: string) => {
    const row = nestedRowRefs.current.get(id);
    if (!row) return;
    setActiveNestedId(id);
    setNestedAnchorRect(row.getBoundingClientRect());
    onNestedChange?.(true);
  }, [onNestedChange]);

  const closeNested = useCallback(() => {
    setActiveNestedId(null);
    setNestedAnchorRect(null);
    onNestedChange?.(false);
  }, [onNestedChange]);

  const toggleNested = useCallback(
    (id: string) => {
      if (activeNestedId === id) {
        closeNested();
        return;
      }
      openNested(id);
    },
    [activeNestedId, closeNested, openNested],
  );

  const nestedEntries = useMemo(() => {
    if (!activeNestedId) return [];
    const nested = entries.find((e) => e.type === "nested" && e.id === activeNestedId);
    return nested?.type === "nested" ? nested.items : [];
  }, [activeNestedId, entries]);

  return (
    <>
      {createPortal(
        <div
          ref={panelRef}
          role="menu"
          data-editor-shell
          data-editor-menu-flyout
          className="editor-menu-dropdown fixed overflow-y-auto border border-app-border bg-app-surface shadow-xl thin-scroll"
          style={{
            left: position.left,
            top: position.top,
            maxHeight: position.maxHeight,
            minWidth: position.width,
            zIndex,
          }}
        >
          {entries.map((entry, i) => {
            if (entry.type === "divider") {
              return (
                <div key={`sd-${i}`} className="my-1.5 border-t border-app-border" role="separator" />
              );
            }

            if (entry.type === "nested") {
              return (
                <MenuActionRow
                  key={`nested-${entry.id}`}
                  label={entry.label}
                  hasSubmenu
                  active={activeNestedId === entry.id}
                  rowRef={(el) => {
                    if (el) nestedRowRefs.current.set(entry.id, el);
                    else nestedRowRefs.current.delete(entry.id);
                  }}
                  onClick={() => toggleNested(entry.id)}
                  onSubmenuToggle={() => toggleNested(entry.id)}
                  onMouseEnter={() => openNested(entry.id)}
                />
              );
            }

            const { item } = entry;
            const shortcut = item.shortcut ? formatShortcutLabel(item.shortcut) : "";
            return (
              <button
                key={`${item.label}-${i}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "editor-menu-dropdown-item",
                  item.disabled
                    ? "cursor-not-allowed text-app-subtle"
                    : "text-app-fg hover:bg-app-hover",
                )}
                onClick={() => {
                  if (item.disabled) return;
                  item.run();
                  onSelect();
                }}
              >
                <span>{item.label}</span>
                {shortcut ? <span className="editor-menu-dropdown-shortcut">{shortcut}</span> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
      {activeNestedId && nestedAnchorRect && nestedEntries.length > 0 ? (
        <MenuFlyoutPanel
          entries={nestedEntries}
          anchorRect={nestedAnchorRect}
          zIndex={zIndex + 1}
          onSelect={onSelect}
        />
      ) : null}
    </>
  );
}

export function EditorNestedMenuDropdown({
  open,
  onClose,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [submenuAnchorRect, setSubmenuAnchorRect] = useState<DOMRect | null>(null);

  const menuRevision = useEditorStore((s) =>
    open
      ? `${s.historyPast.length}:${s.historyFuture.length}:${s.selectedIds.join(",")}:${s.editorMode}`
      : "",
  );

  const rootEntries = useMemo(
    () => buildResolvedLogoMenuRoot(useEditorStore.getState),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when editor state changes
    [menuRevision],
  );

  const submenuEntries = useMemo(
    () => (activeSubmenuId ? buildResolvedSubmenuEntries(activeSubmenuId, useEditorStore.getState) : []),
    [activeSubmenuId, menuRevision],
  );

  const position = useAnchoredDropdownPosition(anchorRef, open, 2, {
    viewportClamp: true,
    maxHeight: 520,
    width: 260,
    remeasureKey: rootEntries.length,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (anchorRef.current?.contains(target)) return;
      if (target.closest("[data-editor-menu-flyout]")) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const id = requestAnimationFrame(() => {
      document.addEventListener("mousedown", onDown);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) {
      setActiveSubmenuId(null);
      setSubmenuAnchorRect(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeSubmenuId) {
          setActiveSubmenuId(null);
          setSubmenuAnchorRect(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, activeSubmenuId]);

  const openSubmenu = useCallback((menuId: string) => {
    const row = rowRefs.current.get(menuId);
    if (!row) return;
    setActiveSubmenuId(menuId);
    setSubmenuAnchorRect(row.getBoundingClientRect());
  }, []);

  const toggleSubmenu = useCallback(
    (menuId: string) => {
      if (activeSubmenuId === menuId) {
        setActiveSubmenuId(null);
        setSubmenuAnchorRect(null);
        return;
      }
      openSubmenu(menuId);
    },
    [activeSubmenuId, openSubmenu],
  );

  if (!open || typeof document === "undefined") return null;

  const renderRootEntry = (entry: ResolvedLogoMenuRootEntry, index: number) => {
    if (entry.type === "divider") {
      return <div key={`d-${index}`} className="my-1.5 border-t border-app-border" role="separator" />;
    }

    if (entry.type === "link") {
      return (
        <button
          key={`link-${entry.href}`}
          type="button"
          role="menuitem"
          className="editor-menu-dropdown-item text-app-fg hover:bg-app-hover"
          onClick={() => {
            onClose();
            router.push(entry.href);
          }}
        >
          <span>{entry.label}</span>
        </button>
      );
    }

    if (entry.type === "submenu") {
      return (
        <MenuActionRow
          key={`submenu-${entry.menuId}`}
          label={entry.label}
          hasSubmenu
          active={activeSubmenuId === entry.menuId}
          rowRef={(el) => {
            if (el) rowRefs.current.set(entry.menuId, el);
            else rowRefs.current.delete(entry.menuId);
          }}
          onClick={() => toggleSubmenu(entry.menuId)}
          onSubmenuToggle={() => toggleSubmenu(entry.menuId)}
          onMouseEnter={() => openSubmenu(entry.menuId)}
        />
      );
    }

    const { item } = entry;
    return (
      <MenuActionRow
        key={`item-${item.label}-${index}`}
        label={item.label}
        shortcut={item.shortcut}
        disabled={item.disabled}
        onClick={() => {
          if (item.disabled) return;
          item.run();
          onClose();
        }}
      />
    );
  };

  return (
    <>
      {createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-editor-shell
          data-editor-menu-flyout
          className="editor-menu-dropdown fixed z-[120] overflow-y-auto border border-app-border bg-app-surface shadow-xl thin-scroll"
          style={anchoredMenuStyle(position)}
        >
          {rootEntries.map(renderRootEntry)}
        </div>,
        document.body,
      )}
      {activeSubmenuId && submenuAnchorRect && submenuEntries.length > 0 ? (
        <MenuFlyoutPanel
          entries={submenuEntries}
          anchorRect={submenuAnchorRect}
          zIndex={121}
          onSelect={onClose}
        />
      ) : null}
    </>
  );
}
