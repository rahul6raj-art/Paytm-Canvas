"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  EDITOR_MENUS,
  resolveMenuItem,
  type MenuItemDef,
  type ResolvedMenuItem,
} from "@/lib/editorMenuConfig";
import { EditorMenuDropdown } from "./menu/EditorMenuDropdown";
import { EditorMenuBarTrailing } from "./EditorMenuBarTrailing";
import { EditorCommandSearchButton } from "./EditorCommandSearchButton";
import { activateCanvasForShortcuts } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";

function buildDropdownItems(items: MenuItemDef[]): (ResolvedMenuItem | "divider")[] {
  const out: (ResolvedMenuItem | "divider")[] = [];
  for (const item of items) {
    if (item.type === "divider") {
      out.push("divider");
      continue;
    }
    const resolved = resolveMenuItem(item, useEditorStore.getState);
    if (resolved) out.push(resolved);
  }
  return out;
}

export function EditorMenuBar() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    anchorRef.current = openMenuId ? menuButtonRefs.current[openMenuId] ?? null : null;
  }, [openMenuId]);

  const menuRevision = useEditorStore((s) =>
    openMenuId
      ? `${s.historyPast.length}:${s.historyFuture.length}:${s.selectedIds.join(",")}:${s.editorMode}:${s.pageOrder.length}`
      : "",
  );

  const openMenu = openMenuId ? EDITOR_MENUS.find((m) => m.id === openMenuId) : null;
  const openItems = openMenu ? buildDropdownItems(openMenu.items) : [];
  void menuRevision;

  return (
    <div
      className="relative z-[2] flex h-8 shrink-0 items-center gap-0 border-b border-app-border-subtle bg-app-panel px-1"
      role="menubar"
      aria-label="Application menu"
      onPointerDownCapture={() => activateCanvasForShortcuts()}
    >
      {EDITOR_MENUS.map((menu) => {
        const open = openMenuId === menu.id;
        return (
          <div key={menu.id} className="relative flex items-stretch">
            <button
              ref={(el) => {
                menuButtonRefs.current[menu.id] = el;
                if (openMenuId === menu.id) anchorRef.current = el;
              }}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              className={cn(
                "chrome-menu-item",
                open
                  ? "bg-app-hover text-app-fg"
                  : "text-app-muted hover:bg-app-hover hover:text-app-fg",
              )}
              onClick={() => setOpenMenuId((id) => (id === menu.id ? null : menu.id))}
              onMouseEnter={() => {
                if (openMenuId && openMenuId !== menu.id) setOpenMenuId(menu.id);
              }}
            >
              {menu.label}
            </button>
          </div>
        );
      })}
      <div className="flex min-w-0 flex-1 justify-center px-2">
        <EditorCommandSearchButton />
      </div>
      <EditorMenuBarTrailing />
      <EditorMenuDropdown
        open={Boolean(openMenuId && openItems.length > 0)}
        items={openItems}
        onClose={() => setOpenMenuId(null)}
        anchorRef={anchorRef}
      />
    </div>
  );
}
