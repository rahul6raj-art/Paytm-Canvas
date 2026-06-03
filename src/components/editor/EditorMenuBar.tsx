"use client";

import { useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  EDITOR_MENUS,
  resolveMenuItem,
  type MenuItemDef,
  type ResolvedMenuItem,
} from "@/lib/editorMenuConfig";
import { EditorMenuDropdown } from "./menu/EditorMenuDropdown";
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
  const menuRevision = useEditorStore((s) =>
    openMenuId
      ? `${s.historyPast.length}:${s.historyFuture.length}:${s.selectedIds.join(",")}:${s.editorMode}:${s.pageOrder.length}`
      : "",
  );

  return (
    <div
      className="flex h-7 shrink-0 items-stretch gap-0 border-b border-app-border-subtle bg-app-panel px-1"
      role="menubar"
      aria-label="Application menu"
    >
      {EDITOR_MENUS.map((menu) => {
        const open = openMenuId === menu.id;
        const items = buildDropdownItems(menu.items);
        void menuRevision;
        return (
          <div key={menu.id} className="relative flex items-stretch">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              className={cn(
                "rounded px-2.5 text-[11px] font-medium transition-colors",
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
            <EditorMenuDropdown
              open={open}
              items={items}
              onClose={() => setOpenMenuId(null)}
            />
          </div>
        );
      })}
    </div>
  );
}
